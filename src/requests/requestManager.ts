import { logger } from "../server";

import StringSimiliarity from "string-similarity";
import { Snack } from "../snackSearch/snack";
import { SnackRequest } from "./snackRequest";
import { SnackRequester } from "./snackRequester";
import { SnackRequestLocation } from "./snackRequestLocation";

import { InstanceType } from "typegoose";

export enum SnackRequestResultType {
    CreatedNew,
    RequestAddedForExisting,
    AlreadyRequestedByUser,
    SimilarExists,
}

export interface SnackRequestResult {
    type: SnackRequestResultType;
    request?: SnackRequest;
}
class RequestManager {
    public minRequestNameSimiliarity: number = 0.65;
    public minRequestDescriptionSimiliarity: number = 0.2;
    // If two products are from the same brand, their similiarity is multiplied by this ammount
    public sameBrandSimilarityMultiplier: number = 1.25;

    public getSnackSimilarity(
        snackA: Snack,
        snackB: Snack
    ): {
        name: number;
        similarity: number;
    } {
        if (snackA.upc === snackB.upc) {
            return {
                name: 1,
                similarity: 1,
            };
        }
        let name = StringSimiliarity.compareTwoStrings(snackA.name || "", snackB.name || "");

        let similarity = StringSimiliarity.compareTwoStrings(snackA.description || "", snackB.description || "");

        if (snackA.brand !== undefined && snackB.brand !== undefined) {
            const sameBrand = snackA.brand.trim().toLocaleUpperCase() === snackB.brand.trim().toLocaleUpperCase();
            if (sameBrand) {
                name *= this.sameBrandSimilarityMultiplier;
                similarity *= this.sameBrandSimilarityMultiplier;
            }
        }
        return {
            name,
            similarity,
        };
    }

    public async requestSnack(
        requester: SnackRequester,
        snack: Snack,
        location: SnackRequestLocation,
        requestString: string,
        forceNewIfSimilar: boolean = false
    ): Promise<SnackRequestResult> {
        let isExistingRequestSimilar = false;
        let isExistingExactlySame = false;

        let existingRequest =
            snack.upc !== undefined
                ? (await this.findSnackRequestByUpc(requester.teamId, location, snack.upc)) || undefined
                : undefined;

        if (existingRequest === undefined) {
            existingRequest = await this.findSnackRequestByText(requester.teamId, location, requestString);
        }

        if (existingRequest) {
            const similarity = this.getSnackSimilarity(existingRequest.snack, snack);

            isExistingRequestSimilar =
                similarity.name > this.minRequestNameSimiliarity &&
                similarity.similarity > this.minRequestDescriptionSimiliarity;

            if (existingRequest.snack.productUrls !== undefined && snack.productUrls !== undefined) {
                for (const [key, value] of Object.entries(snack.productUrls)) {
                    if (existingRequest.snack.productUrls![key] === value) {
                        isExistingExactlySame = true;
                        break;
                    }
                }
            }
        }

        if ((isExistingExactlySame || isExistingRequestSimilar) && existingRequest) {
            logger.trace("Found existing snack request for request: " + JSON.stringify(existingRequest));

            if (!isExistingExactlySame && !forceNewIfSimilar) {
                return {
                    type: SnackRequestResultType.SimilarExists,
                    request: existingRequest,
                };
            }

            const alreadyRequested = existingRequest.requesters.some(
                existingRequester => existingRequester.userId === requester.userId
            );

            if (alreadyRequested) {
                return {
                    type: SnackRequestResultType.AlreadyRequestedByUser,
                    request: existingRequest,
                };
            } else {
                existingRequest.requesters.push(requester);
                await existingRequest.save();

                return {
                    type: SnackRequestResultType.RequestAddedForExisting,
                    request: existingRequest,
                };
            }
        } else {
            logger.trace("Creating new snack request");
            const newRequest = await this.saveSnackRequest(snack, requester, location, requestString);
            return {
                type: SnackRequestResultType.CreatedNew,
                request: newRequest,
            };
        }
    }

    private async findSnackRequestByText(
        teamId: string,
        location: SnackRequestLocation,
        text: string
    ): Promise<InstanceType<SnackRequest> | undefined> {
        const results = await SnackRequest.getModelForTeam(teamId)
            .find({ $text: { $search: text }, "location.id": location.id }, { score: { $meta: "textScore" } }, {})
            .sort({ score: { $meta: "textScore" } })
            .limit(1);

        return results[0] || undefined;
    }

    private async findSnackRequestByUpc(
        teamId: string,
        location: SnackRequestLocation,
        upc: string
    ): Promise<InstanceType<SnackRequest> | undefined> {
        return (
            (await SnackRequest.getModelForTeam(teamId).findOne({
                "snack.upc": upc,
                "location.id": location.id,
            })) || undefined
        );
    }

    private async saveSnackRequest(
        snack: Snack,
        requester: SnackRequester,
        location: SnackRequestLocation,
        originalRequestString: string
    ): Promise<SnackRequest> {
        return SnackRequest.getModelForTeam(requester.teamId).create(
            SnackRequest.create({
                snack,
                initialRequester: requester,
                location,
                originalRequestString,
            })
        );
    }
}

export const RequestManagerInstance = new RequestManager();

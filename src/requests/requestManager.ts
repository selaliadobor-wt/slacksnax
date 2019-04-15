import { logger } from "../server";

import StringSimiliarity from "string-similarity";
import { Snack } from "../snackSearch/snack";
import { SnackRequest } from "./snackRequest";
import { SnackRequester } from "./snackRequester";
import { SnackRequestLocation } from "./snackRequestLocation";

export enum SnackRequestResultType {
    CreatedNew,
    RequestAddedForExisted,
    AlreadyRequestedByUser,
}

export interface SnackRequestResult {
    result: SnackRequestResultType;
    request: SnackRequest;
}
class RequestManager {
    public minRequestNameSimiliarity = 0.7;
    public minRequestDescriptionSimiliarity = 0.8;

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
        const name = StringSimiliarity.compareTwoStrings(snackA.friendlyName || "", snackB.friendlyName || "");

        const similarity = StringSimiliarity.compareTwoStrings(snackA.description || "", snackB.description || "");

        return {
            name,
            similarity,
        };
    }

    public async requestSnack(
        requester: SnackRequester,
        snack: Snack,
        location: SnackRequestLocation,
        requestString: string
    ): Promise<SnackRequestResult> {
        let isExistingRequestSimilar = false;
        let isExistingExactlySame = false;

        let existingRequest =
            snack.upc !== undefined
                ? await this.findSnackRequestByUpc(requester.teamId, location, snack.upc)
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
                for (const [key, value] of existingRequest.snack.productUrls.entries()) {
                    if (snack.productUrls!.get(key) === value) {
                        isExistingExactlySame = true;
                        break;
                    }
                }
            }
        }

        if ((isExistingExactlySame || isExistingRequestSimilar) && existingRequest) {
            logger.trace("Found existing snack request for request: " + JSON.stringify(existingRequest));

            const alreadyRequested = existingRequest.requesters.some(
                existingRequester => existingRequester.userId === requester.userId
            );

            if (alreadyRequested) {
                return {
                    result: SnackRequestResultType.AlreadyRequestedByUser,
                    request: existingRequest,
                };
            } else {
                existingRequest.requesters.push(requester);
                await existingRequest.save();

                return {
                    result: SnackRequestResultType.AlreadyRequestedByUser,
                    request: existingRequest,
                };
            }
        } else {
            logger.trace("Creating new snack request");
            await this.saveSnackRequest(snack, requester, location, requestString);
            return {
                result: SnackRequestResultType.CreatedNew,
                request: existingRequest,
            };
        }
    }

    private async findSnackRequestByText(teamId: string, location: SnackRequestLocation, text: string) {
        const results = await SnackRequest.getModelForTeam(teamId)
            .find({ $text: { $search: text }, "snack.location.id": location.id }, { score: { $meta: "textScore" } }, {})
            .sort({ score: { $meta: "textScore" } })
            .limit(1);

        return results[0];
    }

    private async findSnackRequestByUpc(teamId: string, location: SnackRequestLocation, upc: string) {
        const results = await SnackRequest.getModelForTeam(teamId)
            .find({
                "snack.upc": upc,
                "snack.location.id": location.id,
            })
            .limit(1);

        return results[0];
    }

    private async saveSnackRequest(
        snack: Snack,
        requester: SnackRequester,
        location: SnackRequestLocation,
        originalRequestString: string
    ) {
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

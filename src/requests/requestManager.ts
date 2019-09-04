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
    public minRequestNameSimiliarity: number = 0.4;
    public minRequestDescriptionSimiliarity: number = 0.2;
    // If two products are from the same brand, their similiarity is multiplied by this ammount
    public sameBrandSimilarityMultiplier: number = 1.25;

    public similarDescriptionThreshold: number = 0.5;
    public similarDescriptionMultiplier: number = 1.25;

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
        let nameSimilarity = StringSimiliarity.compareTwoStrings(snackA.name || "", snackB.name || "");

        let descriptionSimilarity = StringSimiliarity.compareTwoStrings(
            snackA.description || "",
            snackB.description || ""
        );

        if (snackA.brand != null && snackB.brand != null) {
            const sameBrand = snackA.brand.trim().toLocaleUpperCase() === snackB.brand.trim().toLocaleUpperCase();
            if (sameBrand) {
                nameSimilarity *= this.sameBrandSimilarityMultiplier;
                descriptionSimilarity *= this.sameBrandSimilarityMultiplier;
            }
        }

        if (descriptionSimilarity > this.similarDescriptionThreshold) {
            nameSimilarity *= this.similarDescriptionMultiplier;
            descriptionSimilarity *= this.similarDescriptionMultiplier;
        }
        return {
            name: nameSimilarity,
            similarity: descriptionSimilarity,
        };
    }
    public async findRequestInDatabase(
        teamId: string,
        request: SnackRequest
    ): Promise<InstanceType<SnackRequest> | undefined> {
        const result = await SnackRequest.getModelForTeam(teamId).findOne({
            id: request.id,
        });
        return result || undefined;
    }

    public async findExistingRequest(
        requester: SnackRequester,
        snack: Snack,
        location: SnackRequestLocation,
        requestString: string
    ): Promise<[InstanceType<SnackRequest>, boolean] | undefined> {
        let isExistingRequestSimilar = false;
        let isExistingExactlySame = false;

        let existingRequest =
            snack.upc !== undefined && snack.upc !== null
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
        return existingRequest === undefined || !isExistingRequestSimilar
            ? undefined
            : [existingRequest, isExistingExactlySame];
    }

    public async addRequesterToSnackRequest(
        existingRequest: InstanceType<SnackRequest>,
        requester: SnackRequester
    ): Promise<void> {
        const alreadyRequested = existingRequest.requesters.some(
            existingRequester =>
                existingRequester.teamId === requester.teamId && existingRequester.userId === requester.userId
        );

        if (alreadyRequested) {
            return;
        }
        existingRequest.requesters.push(requester);
        await existingRequest.save();
    }

    public async createSnackRequest(
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
}

export const RequestManagerInstance = new RequestManager();

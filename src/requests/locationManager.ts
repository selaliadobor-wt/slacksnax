import { SnackRequestLocation } from "./snackRequestLocation";
import { UserLocation } from "./userLocation";
import { createTypedSlackWebClient } from "typed-slack-client/typedSlackWebClient";
import { TeamModel } from "../models/team";
import { ActionManagerInstance } from "../slack/actions/actionManager";
import { SlashCommandManagerInstance } from "../slack/slashCommandManager";
import { FastifyRequest, DefaultQuery, DefaultParams, DefaultHeaders } from "fastify";
import { IncomingMessage } from "http";
import { Definitions } from "typed-slack-client/slackTypes";
import { SlackResponseUrlReplier } from "../slack/slackUtils";
export enum SnackRequestResult {
    CreatedNew,
    RequestAddedForExisted,
    AlreadyRequestedByUser,
}

export type UserLocationPromptContinuation = {
    commandEndpoint: string;
    request: FastifyRequest<
        IncomingMessage,
        DefaultQuery,
        DefaultParams,
        DefaultHeaders,
        Definitions.SlashCommands.RequestBody
    >;
} | null;
class LocationMananger {
    constructor() {
        ActionManagerInstance.listenForCallbackIdOfType(this.locationPromptType, async (payload, reply) => {
            reply.code(200).send();
            let locationId = (<any>payload)["submission"]["location"];
            let location = await SnackRequestLocation.getModelForTeam(payload.team.id).findOne({ id: locationId });
            if (location == null) {
                throw new Error("No matching location found for location: " + locationId);
            }

            this.setRequestLocationForUser(payload.user.id, payload.team.id, location);

            let continuation = await ActionManagerInstance.getInteractionContext<UserLocationPromptContinuation>(
                payload.callback_id
            );
            if (continuation != null) {
                await SlashCommandManagerInstance.invokeSlashCommandForRequest(
                    continuation.commandEndpoint,
                    continuation.request
                );
            } else {
                new SlackResponseUrlReplier(payload.response_url).unformattedText("Updated your location! 🎉");
            }
        });
    }

    private readonly locationPromptType = "location-prompt";

    async promptForUserLocation(
        reason: string,
        userId: string,
        teamId: string,
        triggerId: string,
        responseUrl: string,
        continuation?: UserLocationPromptContinuation
    ) {
        let team = await TeamModel.findOne({ teamId: teamId });
        if (team == null) {
            throw new Error("Failed to find your team");
        }
        let locations = await this.getLocationsForTeam(teamId);

        if (locations == null || locations.length < 1) {
            return await new SlackResponseUrlReplier(responseUrl).unformattedText(
                "Your team hasn't added any Snack locations 😱\n_Checkout the `/addSnaxLocation` command_"
            );
        }

        let slack = createTypedSlackWebClient();
        await slack.dialog.open({
            token: team.accessToken,
            trigger_id: triggerId,
            dialog: {
                title: reason,
                callback_id: await ActionManagerInstance.setInteractionContext(this.locationPromptType, continuation),
                elements: [
                    {
                        type: "select",
                        name: "location",
                        label: "Location",
                        options: locations.map(location => ({
                            label: location.name,
                            value: location.id,
                        })),
                    },
                ],
            },
        });
    }

    async renameLocation(teamId: string, locationId: string, newName: string) {
        let location = await SnackRequestLocation.getModelForTeam(teamId).findOne({ id: locationId });
        if (location == null) {
            throw new Error("No matching location found to rename");
        }

        location.name = newName;
        await location.save();
    }

    async getLocationsForTeam(teamId: string): Promise<SnackRequestLocation[]> {
        return await SnackRequestLocation.getModelForTeam(teamId).find();
    }

    async addLocationForTeam(locationName: string, teamId: string): Promise<boolean> {
        let existingLocation = await SnackRequestLocation.getModelForTeam(teamId).findOne({ name: locationName });
        if (existingLocation != null) {
            return false;
        } else {
            await SnackRequestLocation.getModelForTeam(teamId).create(
                SnackRequestLocation.create({ name: locationName })
            );
            return true;
        }
    }
    async setRequestLocationForUser(userId: string, teamId: string, location: SnackRequestLocation) {
        let existingLocation = await UserLocation.getModelForTeam(teamId).findOne({ userId: userId });
        if (existingLocation) {
            existingLocation.locationId = location.id;
            await existingLocation.save();
        } else {
            await UserLocation.getModelForTeam(teamId).create(
                UserLocation.create({
                    userId: userId,
                    location: location,
                })
            );
        }
    }

    async getRequestLocationForUser(userId: string, teamId: string): Promise<SnackRequestLocation | null> {
        let userLocation = await UserLocation.getModelForTeam(teamId).findOne({ userId: userId });
        if (userLocation == null) {
            return null;
        }

        return await SnackRequestLocation.getModelForTeam(teamId).findOne({
            id: userLocation.locationId,
        });
    }
}

export const LocationManangerInstance = new LocationMananger();

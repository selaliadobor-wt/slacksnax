import { DefaultHeaders, DefaultParams, DefaultQuery, FastifyRequest } from "fastify";
import { IncomingMessage } from "http";
import { createTypedSlackWebClient, Definitions } from "typed-slack-client";
import { TeamModel } from "../models/team";
import { ActionManagerInstance } from "../slack/actions/actionManager";
import { SlackResponseUrlReplier } from "../slack/slackUtils";
import { SlashCommandManagerInstance } from "../slack/slashCommandManager";
import { SnackRequestLocation } from "./snackRequestLocation";
import { UserLocation } from "./userLocation";

export type UserLocationPromptContinuation = {
    commandEndpoint: string;
    request: Definitions.SlashCommands.RequestBody;
} | null;
class LocationMananger {
    private readonly locationPromptType = "location-prompt";
    constructor() {
        ActionManagerInstance.listenForCallbackIdOfType(this.locationPromptType, async (payload, reply) => {
            reply.code(200).send();
            const locationId = (payload as any).submission.location;
            const location = await SnackRequestLocation.getModelForTeam(payload.team.id).findOne({ id: locationId });
            if (location == null) {
                throw new Error("No matching location found for location: " + locationId);
            }

            await this.setRequestLocationForUser(payload.user.id, payload.team.id, location);

            const continuation = await ActionManagerInstance.getInteractionContext<UserLocationPromptContinuation>(
                payload.callback_id
            );
            if (continuation != null) {
                await SlashCommandManagerInstance.invokeSlashCommandForRequest(
                    continuation.commandEndpoint,
                    continuation.request
                );
            } else {
                await new SlackResponseUrlReplier(payload.response_url).unformattedText("Updated your location! 🎉");
            }
        });
    }

    public async promptForUserLocation(
        reason: string,
        userId: string,
        teamId: string,
        triggerId: string,
        responseUrl: string,
        continuation?: UserLocationPromptContinuation
    ) {
        const team = await TeamModel.findOne({ teamId });
        if (team == null) {
            throw new Error("Failed to find your team");
        }
        const locations = await this.getLocationsForTeam(teamId);

        if (locations == null || locations.length < 1) {
            return new SlackResponseUrlReplier(responseUrl).unformattedText(
                "Your team hasn't added any Snack locations 😱\n_Checkout the `/addSnaxLocation` command_"
            );
        }

        const slack = createTypedSlackWebClient();
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

    public async renameLocation(teamId: string, locationId: string, newName: string) {
        const location = await SnackRequestLocation.getModelForTeam(teamId).findOne({ id: locationId });
        if (location == null) {
            throw new Error("No matching location found to rename");
        }

        location.name = newName;
        await location.save();
    }

    public async getLocationsForTeam(teamId: string): Promise<SnackRequestLocation[]> {
        return SnackRequestLocation.getModelForTeam(teamId).find();
    }

    public async addLocationForTeam(locationName: string, teamId: string): Promise<boolean> {
        const existingLocation = await SnackRequestLocation.getModelForTeam(teamId).findOne({ name: locationName });
        if (existingLocation != null) {
            return false;
        } else {
            await SnackRequestLocation.getModelForTeam(teamId).create(
                SnackRequestLocation.create({ name: locationName })
            );
            return true;
        }
    }
    public async setRequestLocationForUser(userId: string, teamId: string, location: SnackRequestLocation) {
        const existingLocation = await UserLocation.getModelForTeam(teamId).findOne({ userId });
        if (existingLocation) {
            existingLocation.locationId = location.id;
            await existingLocation.save();
        } else {
            await UserLocation.getModelForTeam(teamId).create(
                UserLocation.create({
                    userId,
                    location,
                })
            );
        }
    }

    public async getRequestLocationForUser(userId: string, teamId: string): Promise<SnackRequestLocation | null> {
        const userLocation = await UserLocation.getModelForTeam(teamId).findOne({ userId });
        if (userLocation == null) {
            return null;
        }

        return SnackRequestLocation.getModelForTeam(teamId).findOne({
            id: userLocation.locationId,
        });
    }
}

export const LocationManangerInstance = new LocationMananger();

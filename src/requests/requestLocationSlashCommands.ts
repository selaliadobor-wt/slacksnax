import { createTypedSlackWebClient } from "typed-slack-client";
import { TeamModel } from "../models/team";
import { ActionManagerInstance } from "../slack/actions/actionManager";
import { SlackResponseUrlReplier } from "../slack/slackUtils";
import { SlashCommandManagerInstance } from "../slack/slashCommandManager";
import { LocationManangerInstance } from "./locationManager";

export const RenameSnaxLocationSlashCommand = "/renameSnaxLocation";
export const UpdateSnaxLocationSlashCommand = "/updateSnaxLocation";
export const AddSnaxLocationSlashCommand = "/addSnaxLocation";

const slack = createTypedSlackWebClient();

export function registerSlashCommands(): void {
    SlashCommandManagerInstance.registerSlashCommand(UpdateSnaxLocationSlashCommand, async (request, reply) => {
        await LocationManangerInstance.promptForUserLocation(
            "Set your location!",
            request.user_id,
            request.team_id,
            request.trigger_id,
            request.response_url
        );
    });

    const renameLocationPrompt = "rename-snack-location";
    SlashCommandManagerInstance.registerSlashCommand(RenameSnaxLocationSlashCommand, async (request, reply) => {
        const team = await TeamModel.findOne({ teamId: request.team_id });
        if (team === null) {
            throw new Error("Team not found on server.");
        }
        const locations = await LocationManangerInstance.getLocationsForTeam(team.teamId);
        await slack.dialog.open({
            dialog: {
                callback_id: renameLocationPrompt,
                elements: [
                    {
                        name: "location",
                        type: "select",
                        label: "Select a location to rename",
                        options: locations.map(location => ({
                            label: location.name,
                            value: location.id,
                        })),
                    },
                    {
                        type: "text",
                        name: "name",
                        label: "The new name",
                    },
                ],
                title: "Rename a Snax location",
            },
            token: team.accessToken,
            trigger_id: request.trigger_id,
        });
    });

    ActionManagerInstance.listenForCallbackIdOfType(renameLocationPrompt, async (payload, reply) => {
        await reply.code(200).send();
        const locationId = (payload as any).submission.location;
        const name = (payload as any).submission.name;
        await LocationManangerInstance.renameLocation(payload.team.id, locationId, name);
        await new SlackResponseUrlReplier(payload.response_url).unformattedText("🎉 Renamed your Snax location!");
    });

    SlashCommandManagerInstance.registerSlashCommand(AddSnaxLocationSlashCommand, async (request, reply) => {
        if (request.text === null || request.text.length < 5) {
            return reply.unformattedText(
                `Add a name to this request! 🙂 (For example \`${AddSnaxLocationSlashCommand} Floor #3 Kitchen\`)`
            );
        }
        const locationCreated = await LocationManangerInstance.addLocationForTeam(request.text, request.team_id);

        await reply.unformattedText(
            locationCreated ? "Added a new location for snacks! 🎉" : "A location with that name already exists 🙂"
        );
    });
}

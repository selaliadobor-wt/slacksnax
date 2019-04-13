import { LocationManangerInstance } from "./locationManager";
import { createTypedSlackWebClient } from "typed-slack-client/typedSlackWebClient";
import { SlashCommandManagerInstance } from "../slack/slashCommandManager";
import { ActionManagerInstance } from "../slack/actions/actionManager";
import { TeamModel } from "../models/team";
import { SlackResponseUrlReplier } from "../slack/slackUtils";

export const RenameSnaxLocationSlashCommand = "/renameSnaxLocation";
export const UpdateSnaxLocationSlashCommand = "/updateSnaxLocation";
export const AddSnaxLocationSlashCommand = "/addSnaxLocation";

let slack = createTypedSlackWebClient();

export function registerSlashCommands() {
    SlashCommandManagerInstance.registerSlashCommand(UpdateSnaxLocationSlashCommand, async (request, reply) => {
        await LocationManangerInstance.promptForUserLocation(
            "Set your location!",
            request.body.user_id,
            request.body.team_id,
            request.body.trigger_id,
            request.body.response_url
        );
    });

    const renameLocationPrompt = "rename-snack-location";
    SlashCommandManagerInstance.registerSlashCommand(RenameSnaxLocationSlashCommand, async (request, reply) => {
        let team = await TeamModel.findOne({ teamId: request.body.team_id });
        if (team == null) {
            throw new Error("Team not found on server.");
        }
        let locations = await LocationManangerInstance.getLocationsForTeam(team.teamId);
        await slack.dialog.open({
            token: team.accessToken,
            trigger_id: request.body.trigger_id,
            dialog: {
                title: "Rename a Snax location",
                callback_id: renameLocationPrompt,
                elements: [
                    {
                        type: "select",
                        name: "location",
                        options: locations.map(location => ({
                            label: location.name,
                            value: location.id,
                        })),
                        label: "Select a location to rename",
                    },
                    {
                        type: "text",
                        name: "name",
                        label: "The new name",
                    },
                ],
            },
        });
    });

    ActionManagerInstance.listenForCallbackIdOfType(renameLocationPrompt, async (payload, reply) => {
        await reply.code(200).send();
        let locationId = (<any>payload)["submission"]["location"];
        let name = (<any>payload)["submission"]["name"];
        await LocationManangerInstance.renameLocation(payload.team.id, locationId, name);
        new SlackResponseUrlReplier(payload.response_url).unformattedText("🎉 Renamed your Snax location!");
    });

    SlashCommandManagerInstance.registerSlashCommand(AddSnaxLocationSlashCommand, async (request, reply) => {
        if (request.body.text == null || request.body.text.length < 5) {
            return await reply.unformattedText(
                `Add a name to this request! 🙂 (For example \`${AddSnaxLocationSlashCommand} Floor #3 Kitchen\`)`
            );
        }
        let locationCreated = await LocationManangerInstance.addLocationForTeam(
            request.body.text,
            request.body.team_id
        );

        await reply.unformattedText(
            locationCreated ? "Added a new location for snacks! 🎉" : "A location with that name already exists 🙂"
        );
    });
}

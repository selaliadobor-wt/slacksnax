import { LocationManangerInstance } from "./locationManager";
import { createTypedSlackWebClient } from "typed-slack-client/typedSlackWebClient";
import { SlashCommandManagerInstance } from "../slack/slashCommandManager";

export const UpdateSnaxLocationSlashCommand = "/updateSnaxLocation";
export const AddSnaxLocationSlashCommand = "/addSnaxLocation";

export function registerSlashCommands() {
    SlashCommandManagerInstance.registerSlashCommand(UpdateSnaxLocationSlashCommand, async request => {
        await LocationManangerInstance.promptForUserLocation(
            "Set your location!",
            request.body.user_id,
            request.body.team_id,
            request.body.trigger_id,
            null
        );
    });

    SlashCommandManagerInstance.registerSlashCommand(AddSnaxLocationSlashCommand, async (request, reply) => {
        if (request.body.text == null || request.body.text.length < 5) {
            reply.unformattedText(
                `Add a name to this request! 🙂 (For example "${AddSnaxLocationSlashCommand} Floor #3 Kitchen)"`
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

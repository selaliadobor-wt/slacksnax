import { LocationManangerInstance } from "../requests/locationManager";
import { SnackRequester } from "../requests/snackRequester";
import { logger } from "../server";
import { ActionManagerInstance } from "../slack/actions/actionManager";
import { SlashCommandManagerInstance } from "../slack/slashCommandManager";
import { flatten } from "../util";
import { searchAllEngines } from "./searchEngineUtils";
import { Snack } from "./snack";

const snackSearchRequestButtonInteractionId = "snack-search-request-button";

function getSlackTextForSnack(snack: Snack, requestCallbackId: string): any[] {
    return [
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `*${snack.friendlyName}*`,
            },
        },
        {
            type: "image",
            title: {
                type: "plain_text",
                text: "Product Image",
                emoji: true,
            },
            image_url: `https://d2ln0cvn4pv5w2.cloudfront.net/unsafe/fit-in/256x256/filters:quality(100):max_bytes(200000):fill(white)/${
                snack.imageUrl
            }`,
            alt_text: "Product Image",
        },
        {
            type: "actions",
            elements: [
                {
                    type: "button",
                    text: {
                        type: "plain_text",
                        emoji: true,
                        text: "Request This ✅",
                    },
                    value: requestCallbackId,
                    action_id: "createNewRequest",
                },
            ],
        },
    ];
}

export function registerSlashCommands() {
    SlashCommandManagerInstance.registerSlashCommand("/snacksearch", async (request, reply) => {
        const text = request.text;
        const location = await LocationManangerInstance.getRequestLocationForUser(request.user_id, request.team_id);
        if (location === null) {
            try {
                await LocationManangerInstance.promptForUserLocation(
                    "Set your location first!",
                    request.user_id,
                    request.team_id,
                    request.trigger_id,
                    request.response_url,

                    {
                        commandEndpoint: "/snacksearch",
                        request,
                    }
                );
            } catch (err) {
                await reply.unformattedText(JSON.stringify(err));
            }
            return;
        }

        await reply.unformattedText(`Searching for "${text}"⏳`);

        let searchResults = await searchAllEngines(text);
        if (!searchResults) {
            searchResults = []; // TODO: Handle empty response
        }

        searchResults = searchResults.slice(0, 10);
        logger.debug(`Returning ${searchResults.length} products from product search for ${text}`);
        const requester = SnackRequester.create({
            name: request.user_name,
            teamId: request.team_id,
            userId: request.user_id,
        });

        const blockList = flatten(
            await Promise.all(
                searchResults.map(async snack => {
                    const callbackId = await ActionManagerInstance.setInteractionContext(
                        snackSearchRequestButtonInteractionId,
                        {
                            requester,
                            snack,
                        }
                    );
                    return getSlackTextForSnack(snack, callbackId);
                })
            )
        );

        const response = {
            response_type: "ephemeral",
            replace_original: true,
            delete_original: true,
            text: `Found ${searchResults.length} product(s) for ${text}`,
            blocks: blockList,
        };

        logger.debug(response);

        await reply.rawJson(response);
    });
}

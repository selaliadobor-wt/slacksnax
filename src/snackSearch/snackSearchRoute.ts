import { flatten } from "../util";
import { searchAllEngines } from "./searchEngineUtils";
import { SnackRequester } from "../requests/snackRequester";
import { ActionManagerInstance } from "../slack/actions/actionManager";
import { LocationManangerInstance } from "../requests/locationManager";
import { SlashCommandManagerInstance } from "../slack/slashCommandManager";
import { Snack } from "./snack";
const snackSearchRequestButtonInteractionId = "snack-search-request-button";

function getSlackTextForSnack(snack: Snack, requestCallbackId: string): Array<any> {
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

SlashCommandManagerInstance.registerSlashCommand("/snacksearch", async (request, reply) => {
    let text = request.body.text;
    let location = await LocationManangerInstance.getRequestLocationForUser(request.body.user_id, request.body.team_id);
    if (location == null) {
        await LocationManangerInstance.promptForUserLocation(
            "Set your location first!",
            request.body.user_id,
            request.body.team_id,
            request.body.trigger_id,
            {
                commandEndpoint: "/snacksearch",
                request: request,
            }
        );
        await SlashCommandManagerInstance.invokeSlashCommandForRequest("/updateSnaxLocation", request);
        return;
    }
    let searchResults = await searchAllEngines(text);
    if (!searchResults) {
        searchResults = []; //TODO: Handle empty response
    }

    searchResults = searchResults.slice(0, 10);
    request.log.debug(`Returning ${searchResults.length} products from product search for ${text}`);
    let requester = SnackRequester.create({
        name: request.body.user_name,
        teamId: request.body.team_id,
        userId: request.body.user_id,
    });

    let blockList = flatten(
        await Promise.all(
            searchResults.map(async snack => {
                let callbackId = await ActionManagerInstance.setInteractionContext(
                    snackSearchRequestButtonInteractionId,
                    {
                        requester: requester,
                        snack: snack,
                    }
                );
                return getSlackTextForSnack(snack, callbackId);
            })
        )
    );

    let response = {
        response_type: "ephemeral",
        replace_original: true,
        delete_original: true,
        text: `Found ${searchResults.length} product(s) for ${text}`,
        blocks: blockList,
    };

    request.log.debug(response);

    reply(response);
});
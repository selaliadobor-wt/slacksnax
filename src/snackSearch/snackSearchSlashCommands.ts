import { LocationManangerInstance } from "../requests/locationManager";
import { RequestManagerInstance, SnackRequestResultType } from "../requests/requestManager";
import { SnackRequester } from "../requests/snackRequester";
import { logger } from "../server";
import { ActionManagerInstance } from "../slack/actions/actionManager";
import { SlackResponseUrlReplier } from "../slack/slackUtils";
import { SlashCommandManagerInstance } from "../slack/slashCommandManager";
import { flatten } from "../util";
import { searchAllEngines } from "./searchEngineUtils";
import { Snack } from "./snack";

const snackSearchRequestButtonInteractionId = "snack-search-request-button";
const createRequestButtonAction = "createNewRequest";

interface CreateRequestButtonContext {
    requester: SnackRequester;
    snack: Snack;
    text: string;
}
const getSnackRequestFields = (snack: Snack, requester: SnackRequester, except: string[]) => {
    let fields = [
        {
            title: "First Requested By",
            value: requester.name,
            short: true,
        },
    ];
    if (snack.description !== undefined) {
        fields.concat({
            title: "Description",
            value: snack.description.length < 20 ? snack.description : snack.description.slice(0, 20) + "…",
            short: true,
        });
    }
    // Remove undefined fields
    fields = fields.filter(field => field.value);
    return except ? fields.filter(field => !except.includes(field.title)) : fields;
};

function getSlackJsonForCreatedRequest(snack: Snack, requester: SnackRequester) {
    return {
        attachments: [
            {
                // prettier-ignore
                pretext: `🎉 A request has been created for ${snack.name}! 🎉`,
                image_url: snack.imageUrl,
                fields: getSnackRequestFields(snack, requester, ["Number of Requests"]),
            },
        ],
        response_type: "ephemeral",
        replace_original: true,
        delete_original: true,
    };
}

function getSlackJsonForAlreadyRequestedRequest(snack: Snack, requester: SnackRequester) {
    return {
        attachments: [
            {
                // prettier-ignore
                pretext: `😒 You've already requested ${snack.name} 😒`,
                image_url: snack.imageUrl,
                fields: getSnackRequestFields(snack, requester, []),
            },
        ],
        response_type: "ephemeral",
        replace_original: true,
        delete_original: true,
    };
}
function getSlackTextForSnack(snack: Snack, requestCallbackId: string): any[] {
    return [
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `*${snack.name}*`,
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
                    action_id: createRequestButtonAction,
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
                    const callbackId = await ActionManagerInstance.setInteractionContext<CreateRequestButtonContext>(
                        snackSearchRequestButtonInteractionId,
                        {
                            requester,
                            snack,
                            text,
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

    ActionManagerInstance.listenForActionIdOfType(
        createRequestButtonAction,
        async (payload, reply, action, context) => {
            reply.send();
            const slackReply = await new SlackResponseUrlReplier(payload.response_url);
            await slackReply.unformattedText("Creating your request ⏳");
            const createContextId = (action as any).value;
            const createContext = await ActionManagerInstance.getInteractionContext<CreateRequestButtonContext>(
                createContextId
            );

            if (createContext === undefined) {
                await slackReply.unformattedText("Your search has expired 🙁");
                return;
            }

            const userLocation = await LocationManangerInstance.getRequestLocationForUser(
                payload.user.id,
                payload.team.id
            );
            if (userLocation === undefined) {
                await slackReply.unformattedText(`You need to set your location with \`/updateSnaxLocation\` first 🙁`);
                return;
            }
            const result = await RequestManagerInstance.requestSnack(
                createContext.requester,
                createContext.snack,
                userLocation,
                createContext.text
            );
            switch (result.type) {
                case SnackRequestResultType.CreatedNew:
                    await slackReply.rawJson(
                        getSlackJsonForCreatedRequest(createContext.snack, createContext.requester)
                    );
                    break;
                case SnackRequestResultType.AlreadyRequestedByUser:
                    await slackReply.rawJson(
                        getSlackJsonForAlreadyRequestedRequest(createContext.snack, createContext.requester)
                    );
                default:
                    break;
            }
        }
    );
}

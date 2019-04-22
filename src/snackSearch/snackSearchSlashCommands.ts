import { Document } from "mongoose";
import { Definitions } from "typed-slack-client";
import { LocationManangerInstance } from "../requests/locationManager";
import { RequestManagerInstance, SnackRequestResultType } from "../requests/requestManager";
import { SnackRequest } from "../requests/snackRequest";
import { SnackRequester } from "../requests/snackRequester";
import { SnackRequestLocation } from "../requests/snackRequestLocation";
import { logger } from "../server";
import { ActionManagerInstance } from "../slack/actions/actionManager";
import { SlackResponseUrlReplier } from "../slack/slackUtils";
import { SlashCommandManagerInstance } from "../slack/slashCommandManager";
import { flatten } from "../util";
import { searchAllEngines } from "./searchEngineUtils";
import { Snack } from "./snack";
import { InstanceType } from "typegoose";

const snackSearchRequestButtonInteractionId = "snack-search-request-button";
const createRequestButtonAction = "createNewRequest";
const similarRequestInteractionId = "resolve-similar-request";
const similarRequestCreateValue = "create-request";
const similarRequestVoteValue = "vote-for-request";

interface CreateRequestButtonContext {
    requester: SnackRequester;
    snack: Snack;
    text: string;
    location: SnackRequestLocation;
}
interface ResolveSimilarRequestContext {
    existingRequest: SnackRequest;
    createContext: CreateRequestButtonContext;
}
const getSnackRequestFields = (snack: Snack, requester: SnackRequester, except: string[]): any => {
    let fields = [
        {
            title: "First Requested By",
            value: requester.name,
            short: true,
        },
    ];

    if (snack.description !== null && snack.description !== undefined) {
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

interface SlackMessage {
    title: string;
    value: string | undefined;
    short: boolean;
}

function getSlackJsonForSimilarRequest(existingRequest: SnackRequest, newSnack: Snack, requestCallbackId: string): any {
    const fields: SlackMessage[] = [
        {
            title: "Your snack's name",
            value: newSnack.name,
            short: true,
        },
        {
            title: "Already requested snack's name",
            value: existingRequest.snack.name,
            short: true,
        },
    ];

    if (newSnack.description !== null) {
        fields.push({
            title: "Your snack's description",
            value: newSnack.description,
            short: true,
        });
    }

    if (existingRequest.snack.description !== null) {
        fields.push({
            title: "Your snack's description",
            value: existingRequest.snack.description,
            short: true,
        });
    }

    return {
        text: "🤔 It looks like a similar request was made earlier...",
        attachments: [
            {
                pretext: "Here's a comparision",
                image_url: existingRequest.snack.imageUrl || undefined,
                thumb_url: newSnack.imageUrl || undefined,
                fields,
            },
            {
                pretext: "Do you want to add a vote for the existing item?",
                fallback: "Looks like your workspace hasn't enabled buttons...SlackSnax needs those",
                callback_id: requestCallbackId,
                color: "#3AA3E3",
                attachment_type: "default",
                actions: [
                    {
                        name: "addToExistingRequest",
                        text: "✅ Sure",
                        type: "button",
                        value: similarRequestVoteValue,
                    },
                    {
                        name: "createNewRequest",
                        text: "🙅 No, make a new request",
                        type: "button",
                        value: similarRequestCreateValue,
                    },
                ],
            },
        ],
        response_type: "ephemeral",
        replace_original: true,
        delete_original: true,
    };
}

function getSlackJsonForAddedRequester(request: SnackRequest): any {
    return {
        attachments: [
            {
                // prettier-ignore
                pretext: `${request.snack.name} was already added to the request list 😌
I'll just make a note that you want that too ✅`,
                image_url: request.snack.imageUrl,
                fields: getSnackRequestFields(request.snack, SnackRequest.getInitialRequester(request), []),
            },
        ],
        response_type: "ephemeral",
        replace_original: true,
        delete_original: true,
    };
}
function getSlackJsonForCreatedRequest(snack: Snack, requester: SnackRequester): any {
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

function getSlackJsonForAlreadyRequestedRequest(snack: Snack, requester: SnackRequester): any {
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

export function registerSlashCommands(): void {
    SlashCommandManagerInstance.registerSlashCommand("/snacksearch", async (request, reply) => {
        const text = request.text;
        const location = await LocationManangerInstance.getRequestLocationForUser(request.user_id, request.team_id);
        if (location === null || location === undefined) {
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
                            location,
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
    ActionManagerInstance.listenForCallbackIdOfType(similarRequestInteractionId, async (payload, reply) => {
        reply.code(200).send();
        const action = payload.actions[0] as any;
        const context = await ActionManagerInstance.getInteractionContext<ResolveSimilarRequestContext>(
            payload.callback_id
        );
        const replier = new SlackResponseUrlReplier(payload.response_url);
        if (context === undefined) {
            await replier.unformattedText("Your search has expired 🙁");
            return;
        }
        const didUserVote = action.value === similarRequestVoteValue;
        const result = await RequestManagerInstance.requestSnack(
            context.createContext.requester,
            context.createContext.snack,
            context.createContext.location,
            context.createContext.text,
            true,
            didUserVote
        );

        switch (result.type) {
            case SnackRequestResultType.AlreadyRequestedByUser:
            case SnackRequestResultType.RequestAddedForExisting:
                if (result.request === undefined) {
                    throw new Error("Did not return result despite RequestAddedForExisting");
                }
                await replier.rawJson(getSlackJsonForAddedRequester(result.request));
                break;
            case SnackRequestResultType.CreatedNew:
                await replier.rawJson(
                    getSlackJsonForCreatedRequest(context.createContext.snack, context.createContext.requester)
                );
                break;
        }
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

            const result = await RequestManagerInstance.requestSnack(
                createContext.requester,
                createContext.snack,
                createContext.location,
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
                    break;
                case SnackRequestResultType.SimilarExists:
                    const existingRequest = result.request;
                    if (!existingRequest) {
                        throw new Error("Internal error: Existing request not returned for SimilarExists");
                    }
                    const callbackId = await ActionManagerInstance.setInteractionContext<ResolveSimilarRequestContext>(
                        similarRequestInteractionId,
                        {
                            existingRequest,
                            createContext,
                        }
                    );
                    await slackReply.rawJson(
                        getSlackJsonForSimilarRequest(result.request!, createContext.snack, callbackId)
                    );
                    break;
                case SnackRequestResultType.RequestAddedForExisting:
                    if (result.request === undefined) {
                        throw new Error("Did not return result despite RequestAddedForExisting");
                    }
                    await slackReply.rawJson(getSlackJsonForAddedRequester(result.request));
                    break;
                default:
                    break;
            }
        }
    );
}

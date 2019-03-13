import * as fastify from "fastify";
import { Server, IncomingMessage, ServerResponse } from "http";
import { WebClient, WebAPICallResult } from "@slack/client";
import { Team, TeamModel } from "../models/team";
import { flatten } from "../util";
import { searchAllEngines } from "../snackSearch/searchEngine";
const web = new WebClient();

interface SlackSlashCommandRequestBody {
    text: string;
    user_id: string;
    user_name: string;
}

function getSlackTextForSnack(snack: Snack): Array<any> {
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
    ];
}

export = <fastify.Plugin<Server, IncomingMessage, ServerResponse, never>>async function(instance) {
    instance.post<
        fastify.DefaultQuery,
        fastify.DefaultParams,
        fastify.DefaultHeaders,
        SlackSlashCommandRequestBody
    >("/snacksearch", async function(request, reply) {
        let text = request.body["text"];

        try {
            let searchResults = await searchAllEngines(text);
            if (!searchResults) {
                searchResults = []; //TODO: Handle empty response
            }

            searchResults = searchResults.slice(0, 10);
            request.log.debug(
                `Returning ${searchResults.length} products from product search for ${text}`
            );

            let blockList = flatten(
                await Promise.all(
                    searchResults.map(async snack => {
                        return getSlackTextForSnack(snack);
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

            reply.send(response);
        } catch (err) {
            reply.status(500).send(err);
        }
    });
};

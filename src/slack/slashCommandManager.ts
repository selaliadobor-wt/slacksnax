import * as fastify from "fastify";
import { IncomingMessage } from "http";
import { Definitions } from "typed-slack-client/slackTypes";
import { SlackResponseUrlReplier } from "./slackUtils";

type SlashCommandRequestType = fastify.FastifyRequest<
    IncomingMessage,
    fastify.DefaultQuery,
    fastify.DefaultParams,
    fastify.DefaultHeaders,
    Definitions.SlashCommands.RequestBody
>;

type SlashCommandReplyCallback = (request: SlashCommandRequestType, reply: SlackResponseUrlReplier) => Promise<void>;

class SlashCommandManager {
    fastify: fastify.FastifyInstance | undefined;
    commands: Map<string, SlashCommandReplyCallback> = new Map();

    registerSlashCommand(endpointName: string, callback: SlashCommandReplyCallback) {
        if (!this.fastify) {
            throw new Error("The SlashCommandManager must be registered with fastify before use");
        }
        this.commands.set(endpointName, callback);
        this.fastify.post(endpointName, async (request, reply) => {
            await reply.code(200).send();
            await this.invokeSlashCommandForRequest(endpointName, request);
        });
    }

    async invokeSlashCommandForRequest(commandEndpoint: string, request: SlashCommandRequestType) {
        let callback = this.commands.get(commandEndpoint);
        if (callback == null) {
            throw new Error("No slash command defined for endpoint: " + commandEndpoint);
        }

        let replier = new SlackResponseUrlReplier(request.body.response_url);

        try {
            await callback(request, replier);
        } catch (err) {
            await replier.unformattedText(`Failed to proccess your request: ${err}`);
        }
    }

    setFastifyInstance(fastify: fastify.FastifyInstance) {
        this.fastify = fastify;
    }
}

export const SlashCommandManagerInstance = new SlashCommandManager();

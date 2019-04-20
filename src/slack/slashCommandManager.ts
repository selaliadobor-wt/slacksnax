import * as fastify from "fastify";
import { IncomingMessage } from "http";
import { Definitions } from "typed-slack-client";
import { SlackResponseUrlReplier } from "./slackUtils";

type SlashCommandRequestType = fastify.FastifyRequest<
    IncomingMessage,
    fastify.DefaultQuery,
    fastify.DefaultParams,
    fastify.DefaultHeaders,
    Definitions.SlashCommands.RequestBody
>;

type SlashCommandReplyCallback = (
    request: Definitions.SlashCommands.RequestBody,
    reply: SlackResponseUrlReplier
) => Promise<void>;

class SlashCommandManager {
    public fastify: fastify.FastifyInstance | undefined;
    public commands: Map<string, SlashCommandReplyCallback> = new Map();

    public registerSlashCommand(endpointName: string, callback: SlashCommandReplyCallback): void {
        if (!this.fastify) {
            throw new Error("The SlashCommandManager must be registered with fastify before use");
        }
        this.commands.set(endpointName, callback);
        this.fastify.post(endpointName, async (request, reply) => {
            reply.send();
            await reply.code(200).send();
            await this.invokeSlashCommandForRequest(endpointName, request.body);
        });
    }

    public async invokeSlashCommandForRequest(
        commandEndpoint: string,
        request: Definitions.SlashCommands.RequestBody
    ): Promise<void> {
        const callback = this.commands.get(commandEndpoint);
        if (callback === undefined) {
            throw new Error("No slash command defined for endpoint: " + commandEndpoint);
        }

        const replier = new SlackResponseUrlReplier(request.response_url);

        try {
            await callback(request, replier);
        } catch (err) {
            await replier.unformattedText(`Failed to proccess your request: ${err}`);
        }
    }

    public setFastifyInstance(instance: fastify.FastifyInstance): void {
        this.fastify = instance;
    }
}

export const SlashCommandManagerInstance = new SlashCommandManager();

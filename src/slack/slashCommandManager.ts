import * as fastify from "fastify";
import { Server, IncomingMessage, ServerResponse } from "http";
import * as rp from "request-promise";
import { Definitions } from "typed-slack-client/slackTypes";
type SlashCommandRequestType = fastify.FastifyRequest<
    IncomingMessage,
    fastify.DefaultQuery,
    fastify.DefaultParams,
    fastify.DefaultHeaders,
    Definitions.SlashCommands.RequestBody
>;
type SlashCommandReplyCallback = (
    request: SlashCommandRequestType,
    reply: (body: object) => Promise<void>
) => Promise<void>;

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

        let responseUrlReply = async (body: object) => {
            await rp.post(request.body.response_url, {
                json: true,
                body: body,
            });
        };

        try {
            await callback(request, responseUrlReply);
        } catch (err) {
            await responseUrlReply({
                response_type: "ephemeral",
                replace_original: true,
                delete_original: true,
                text: `Failed to proccess your request: ${err}`,
            });
        }
    }

    setFastifyInstance(fastify: fastify.FastifyInstance) {
        this.fastify = fastify;
    }
}

export const SlashCommandManagerInstance = new SlashCommandManager();

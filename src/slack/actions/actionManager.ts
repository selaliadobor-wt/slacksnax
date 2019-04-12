import Redis from "ioredis";
import * as fastify from "fastify";
import { Server, IncomingMessage, ServerResponse } from "http";
import { WebClient, WebAPICallResult } from "@slack/client";
import { logger } from "../../server";
import uuid from "uuid/v4";
import { Definitions } from "typed-slack-client/slackTypes";
import { redis } from "../../redis";
type ActionCallback = (
    payload: Definitions.InteractiveActions.Payload,
    reply: fastify.FastifyReply<ServerResponse>
) => Promise<void>;
type ContextIdActionCallback = (
    payload: Definitions.InteractiveActions.Payload,
    reply: fastify.FastifyReply<ServerResponse>,
    action: Definitions.InteractiveActions.PayloadAction,
    context: string
) => Promise<void>;

class ActionManager {
    constructor() {}
    callbacks: ActionCallback[] = [];
    contextCacheTtl = 60 * 5;
    private getRedisKeyForContext = (contextId: string) => `slack-interaction-context:${contextId}`;

    async setInteractionContext<T>(interactionType: string, context: T): Promise<string> {
        let contextId = `${interactionType}:${uuid()}`;
        let redisKey = this.getRedisKeyForContext(contextId);
        await redis.set(redisKey, JSON.stringify(context), "ex", this.contextCacheTtl);
        return contextId;
    }

    async getInteractionContext<T>(contextId: string): Promise<T | null> {
        let context = await redis.get(this.getRedisKeyForContext(contextId));
        if (context == null) {
            return null;
        }
        return JSON.parse(context);
    }

    listenForSlackInteractions(callback: ActionCallback): void {
        this.callbacks.push(callback);
    }

    listenForCallbackIdOfType(actionType: string, callback: ActionCallback): void {
        this.callbacks.push(async (payload, reply) => {
            if (payload.callback_id == undefined) {
                return;
            }

            if (payload.callback_id.startsWith(actionType)) {
                callback(payload, reply);
            }
        });
    }

    listenForBlockIdOfType(actionType: string, callback: ContextIdActionCallback): void {
        this.callbacks.push(async (payload, reply) => {
            if (payload.actions == undefined) {
                return;
            }

            payload.actions.forEach(action => {
                if (action.block_id.startsWith(actionType)) {
                    callback(payload, reply, action, action.block_id);
                }
            });
        });
    }

    listenForActionIdOfType(actionType: string, callback: ContextIdActionCallback): void {
        this.callbacks.push(async (payload, reply) => {
            if (payload.actions == undefined) {
                return;
            }

            payload.actions.forEach(action => {
                if (action.action_id.startsWith(actionType)) {
                    callback(payload, reply, action, action.action_id);
                }
            });
        });
    }

    routes(): fastify.Plugin<Server, IncomingMessage, ServerResponse, never> {
        return async (instance: fastify.FastifyInstance) =>
            instance.post<fastify.DefaultQuery, fastify.DefaultParams, fastify.DefaultHeaders, { payload: string }>(
                "/slackInteractiveActions",
                async (request, reply) => {
                    for (let callback of this.callbacks) {
                        try {
                            await callback(
                                <Definitions.InteractiveActions.Payload>JSON.parse(request.body.payload),
                                reply
                            );

                            if (reply.sent) {
                                logger.info("Handled callback for action", reply, request.body);
                                break;
                            }
                        } catch (err) {
                            logger.error("Failed to process callback for action", err, request.body);
                        }
                    }
                    if (!reply.sent) {
                        logger.error("Failed to find working callback for interaction", request.body);
                        reply.code(500).send("Sorry an internal error occured.");
                    }
                }
            );
    }
}

const ActionManagerInstance = new ActionManager();
export { ActionManagerInstance };

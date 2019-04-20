import { WebAPICallResult, WebClient } from "@slack/client";
import * as fastify from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { Team, TeamModel } from "../models/team";
import { Snack } from "./snack";

const web = new WebClient();

const clientId = process.env.SLACK_CLIENT_ID;
const clientSecret = process.env.SLACK_CLIENT_SECRET;

if (clientId === undefined || clientSecret === undefined) {
    throw new Error("Slack Client ID and Secret not configured.");
}

interface SlackOAuthRequestQuery {
    code: string;
}

async function updateOrCreateTeamToken(team: Team): Promise<boolean> {
    const matchingTeam = await TeamModel.findOne({ teamId: team.teamId });

    const isNewTeam = matchingTeam === null;

    const authedTeam = isNewTeam ? new TeamModel(team) : matchingTeam!.set(team);

    await authedTeam.save();
    return isNewTeam;
}

export const plugin: fastify.Plugin<Server, IncomingMessage, ServerResponse, never> = async instance => {
    instance.get<SlackOAuthRequestQuery, fastify.DefaultParams, fastify.DefaultHeaders, fastify.DefaultBody>(
        "/slackOauthCallback",
        async (request, reply) => {
            const code = request.query.code;

            const oauthResult = (await web.oauth.access({
                client_id: clientId,
                client_secret: clientSecret,
                code,
            })) as any;

            if (!oauthResult.ok) {
                throw new Error(oauthResult.error);
            }
            const teamId = oauthResult.team_id;

            const team: Team = new Team({
                teamId,
                teamName: oauthResult.team_name,
                userId: oauthResult.user_id,
                accessToken: oauthResult.access_token,
            });

            const isNewTeam = await updateOrCreateTeamToken(team);
            request.log.info(`Retrived OAuth token for team. Name: ${team.teamName}, Is New Team?: ${isNewTeam}`);
            reply.code(200).send({
                ok: true,
                isNewTeam,
            });
        }
    );
};

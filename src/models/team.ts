import { InstanceType, ModelType, prop, Typegoose } from "typegoose";

export class Team extends Typegoose {
    @prop({ required: true })
    public teamId: string;
    @prop({ required: true })
    public teamName: string;
    @prop({ required: true })
    public userId: string;
    @prop({ required: true })
    public accessToken: string;
    constructor({});
    constructor(args: { teamId: string; teamName: string; userId: string; accessToken: string }) {
        super();

        this.teamId = args.teamId;
        this.teamName = args.teamName;
        this.userId = args.userId;
        this.accessToken = args.accessToken;
    }
}

export const TeamModel = new Team({}).getModelForClass(Team, {
    schemaOptions: { timestamps: true },
});

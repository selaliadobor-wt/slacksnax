import { prop, Typegoose, ModelType, InstanceType } from "typegoose";

export class SnackRequester {
    @prop({ required: true })
    name!: string;
    @prop({ required: false })
    userId!: string;
    @prop({ required: false })
    teamId!: string;

    static create(args: { name: string; userId: string; teamId: string }) {
        let field = new SnackRequester();

        field.name = args.name;
        field.userId = args.userId;
        field.teamId = args.teamId;
        return field;
    }
}

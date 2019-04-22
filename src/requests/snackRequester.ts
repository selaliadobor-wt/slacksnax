import { InstanceType, ModelType, prop, Typegoose } from "typegoose";

export class SnackRequester extends Typegoose {
    public static create(args: { name: string; userId: string; teamId: string }): SnackRequester {
        const field = new SnackRequester();

        field.name = args.name;
        field.userId = args.userId;
        field.teamId = args.teamId;
        return field;
    }
    @prop({ required: true })
    public name!: string;
    @prop({ required: false })
    public userId!: string;
    @prop({ required: false })
    public teamId!: string;
}

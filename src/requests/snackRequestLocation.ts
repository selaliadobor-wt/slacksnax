import { InstanceType, ModelType, prop, staticMethod, Typegoose } from "typegoose";
import { v4 as uuid } from "uuid";

export class SnackRequestLocation extends Typegoose {
    public static create(args: { name: string }) {
        const field = new SnackRequestLocation();

        field.name = args.name;
        field.id = uuid();
        return field;
    }

    @staticMethod
    public static getModelForTeam(teamId: string) {
        return new SnackRequestLocation().getModelForClass(SnackRequestLocation, {
            schemaOptions: { timestamps: true, collection: `snack-request-locations-${teamId}` },
        });
    }
    @prop({ required: true })
    public id!: string;
    @prop({ required: true })
    public name!: string;
}

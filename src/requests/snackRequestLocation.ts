import { prop, Typegoose, ModelType, InstanceType, staticMethod } from "typegoose";
import { v4 as uuid } from "uuid";

export class SnackRequestLocation extends Typegoose {
    @prop({ required: true })
    id!: string;
    @prop({ required: true })
    name!: string;

    static create(args: { name: string }) {
        let field = new SnackRequestLocation();

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
}

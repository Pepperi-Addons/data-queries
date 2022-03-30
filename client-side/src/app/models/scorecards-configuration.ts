import { PepSizeType } from "@pepperi-addons/ngx-lib";
import { DataQuery } from "../../../../server-side/models/data-query";
import { BaseConfiguration } from "./base-configuration";
import { Color } from "./color";
import { DropShadow } from "./dropshadow";

export class ScorecardsConfiguration extends BaseConfiguration {
    titleSize: PepSizeType = 'sm';
    valueSize: PepSizeType = 'xl';
}

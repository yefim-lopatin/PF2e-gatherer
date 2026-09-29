import {MODULE_ID} from "./main.js";

const RESOURCE_PATH = {
    "dnd5e": "attributes.hp.value",
}

const RESOURCE_VALUE = {
    "dnd5e": "0",
}

export function registerSettings() {

    game.settings.register(MODULE_ID, "enableHarvesting", {
        name: game.i18n.localize(`${MODULE_ID}.settings.enableHarvesting.name`),
        scope: "world",
        config: true,
        default: true,
        type: Boolean,
    });

    game.settings.register(MODULE_ID, "quantityPath", {
        name: game.i18n.localize(`${MODULE_ID}.settings.quantityPath.name`),
        hint: game.i18n.localize(`${MODULE_ID}.settings.quantityPath.hint`),
        scope: "world",
        config: true,
        default: "quantity",
        type: String,
    });

    game.settings.register(MODULE_ID, "resourcePath", {
        name: game.i18n.localize(`${MODULE_ID}.settings.resourcePath.name`),
        hint: game.i18n.localize(`${MODULE_ID}.settings.resourcePath.hint`),
        scope: "world",
        config: true,
        default: RESOURCE_PATH[game.system.id] ?? "",
        type: String,
    });

    game.settings.register(MODULE_ID, "resourceValue", {
        name: game.i18n.localize(`${MODULE_ID}.settings.resourceValue.name`),
        hint: game.i18n.localize(`${MODULE_ID}.settings.resourceValue.hint`),
        scope: "world",
        config: true,
        default: RESOURCE_VALUE[game.system.id] ?? "",
        type: String,
    });

}
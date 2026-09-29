import { MODULE_ID } from "./main.js";

export function canBeHarvested(actor) {
    const resourcePath = game.settings.get(MODULE_ID, "resourcePath");
    const resourceValue = game.settings.get(MODULE_ID, "resourceValue");

    if(!resourcePath || resourceValue == "") return true;

    const resource = foundry.utils.getProperty(actor.system, resourcePath);
    if (resource === undefined) return false;
    
    const value = foundry.utils.getProperty(actor.system, resourceValue) ?? JSON.parse(resourceValue);

    return value == resource;
}
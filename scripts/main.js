import {GathererSheet} from "./gathererSheet.js";
import { GathererActorConfig } from "./actorConfig.js";
import {registerSettings} from "./config.js";
import { canBeHarvested } from "./helpers.js";
import {Socket} from "./lib/socket.js";
export const MODULE_ID = "gatherer";


Hooks.once("ready", function () {
    CONFIG.GATHERER = {};
    async function updateJournal(data) {
        const journal = await fromUuid(data.uuid);
        if (journal) {
            if (data.reset) {
                journal.unsetFlag(MODULE_ID, "data");
            } else {
                journal.setFlag(MODULE_ID, "data", data);
            }
        }
    }

    async function updateActor(data) {
        const actor = await fromUuid(data.uuid);
        if (actor) {
            const draws = actor.getFlag(MODULE_ID, "draws") ?? "";
            if (!Number.isNumeric(draws)) return;
            const drawsInt = parseInt(draws);
            if (drawsInt <= 0) return;
            const newDraws = drawsInt - 1;
            await actor.setFlag(MODULE_ID, "draws", newDraws);
        }
    }

    Socket.register("updateJournal", updateJournal);
    Socket.register("updateActor", updateActor);

    
    CONFIG.GATHERER.harvestToken = async function (token) {
        token = token ?? Array.from(game.user.targets)[0];
        const actor = token?.actor;
        if (!actor) return;
        const journal = actor.getFlag(MODULE_ID, "gatherSheet") ?? "";
        if (!journal) return ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.error.noJournal`));
        const draws = actor.getFlag(MODULE_ID, "draws") ?? "";
        const hasDraws = Number.isNumeric(draws);
        const drawsInt = parseInt(draws);
        if (hasDraws && drawsInt <= 0) return ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.error.noDraws`));
        const document = await fromUuid(journal);
        if (!document) return;
        if(!canBeHarvested(actor)) return ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.error.cantHarvest`) + ` ${game.settings.get(MODULE_ID, "resourcePath")} != ${game.settings.get(MODULE_ID, "resourceValue")}`)
        document.render(false);
        await document.sheet.getGathererData();
        document.sheet._onGather(!hasDraws, actor);
    };

    CONFIG.GATHERER.gather = async function (pageUuid, actorUuid) {
        const actor = actorUuid ? await fromUuid(actorUuid) : null;
        const journal = await fromUuid(pageUuid);
        if (!journal) return;
        journal.render(false);
        await journal.sheet.getGathererData();
        journal.sheet._onGather(true, null, actor);
    };
});

Hooks.on("init", () => {

    registerSettings();

    DocumentSheetConfig.registerSheet(JournalEntryPage, MODULE_ID, GathererSheet, {
        types: ["text"],
        label: "Gatherer Sheet",
    });

    game.keybindings.register(MODULE_ID, "harvestToken", {
        name: game.i18n.localize(`${MODULE_ID}.harvestToken`),
        editable: [{key: "KeyG", modifiers: [KeyboardManager.MODIFIER_KEYS.SHIFT]}],
        restricted: false,
        onDown: () => {},
        onUp: () => {
            CONFIG.GATHERER.harvestToken();
        },
    });
});

Hooks.on("updateWorldTime", () => {
    GathererSheet._onUpdateWorldTime();
});

Hooks.on("getActorSheetHeaderButtons", (app, buttons) => {
    if (!app.actor.hasPlayerOwner && game.user.isGM && game.settings.get(MODULE_ID, "enableHarvesting")) {
        buttons.unshift({
            class: "gatherer",
            icon: "fas fa-leaf",
            label: "Gatherer",
            onclick: () => {
                new GathererActorConfig(app.actor).render(true);
            },
        });
    }
});

Hooks.on("getHeaderControlsActorSheetV2", (app, buttons) => {
    if (!app.document.hasPlayerOwner && game.user.isGM && game.settings.get(MODULE_ID, "enableHarvesting")) {
        buttons.push({
            action: "gatherer",
            icon: "fas fa-leaf",
            label: "Gatherer",
            onClick: () => {
                new GathererActorConfig(app.document).render(true);
            },
        });
    }
} )
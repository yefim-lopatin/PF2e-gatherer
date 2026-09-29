import {Socket} from "./lib/socket.js";
import { MODULE_ID } from "./main.js";

export class GathererSheet extends JournalTextPageSheet {
    activateListeners(html) {
        super.activateListeners(html);
        this.injectGatherer(html);
        if (!this.isEditable) return;
        const flags = this.object.flags.gatherer ?? {};
        let selectOptions = {};
        Array.from(game.tables).forEach((t) => (selectOptions[t.uuid] = t.name));
        flags.tables = selectOptions;
        const systemData = this.getSystemData();
        if (systemData) {
            foundry.utils.mergeObject(flags, systemData);
            flags.systemData = true;
        }
        renderTemplate("modules/gatherer/templates/GathererSheetConfig.hbs", flags).then((configHtml) => {
            html.find(".editor").before(configHtml);
        });
    }

    getSystemData() {
        switch (game.system.id) {
            case "dnd5e":
                let abil = {};
                let skills = {};
                for (let [k, v] of Object.entries(game.dnd5e.config.skills)) {
                    skills[k] = v.label;
                }
                for (let [k, v] of Object.entries(game.dnd5e.config.abilities)) {
                    abil[k] = v.label;
                }
                const data = foundry.utils.mergeObject(foundry.utils.deepClone(abil), foundry.utils.deepClone(skills));
                return { systemSelect: data };
            default:
                return null;
        }
    }

    async injectGatherer(html) {
        const data = await this.getGathererData();
        const gathererHtml = await renderTemplate("modules/gatherer/templates/GathererSheet.hbs", data);
        this._onReset();
        const $gathererHtml = $(gathererHtml);
        $gathererHtml.on("click", ".gatherer-item", (e) => {
            const uuid = e.currentTarget.dataset.uuid;
            fromUuid(uuid).then((item) => {
                item?.sheet?.render(true);
            });
        });
        $gathererHtml.on("click", "#gatherer-reset", (e) => {
            this._onReset(true);
        });
        $gathererHtml.on("click", "#gatherer-gather", (e) => {
            this._onGather();
        });
        $gathererHtml.on("click", "#gatherer-edit", (e) => {
            this.document.sheet.render(true);
        });
        html.closest(".journal-entry-content").append($gathererHtml);
    }

    async getGathererData() {
        let data = foundry.utils.deepClone(this.object.flags.gatherer ?? {});
        if (data.table) data.table = await fromUuid(data.table);
        this._gathererData = data;
        const flag = foundry.utils.mergeObject(this.defaultGathererData, this.object.getFlag("gatherer", "data") || {});
        data = { ...data, isGM: game.user.isGM, pullsRemaining: this.MAX_DRAWS - flag.drawsUsed, resetTime: this.hasTime ? (flag.firstDrawTime == 0 ? game.i18n.localize("gatherer.sheet.waitingFirst") : this.parseMStoTime(this.TIMEMS - (game.time.worldTime * 1000 - flag.firstDrawTime * 1000))) : null, hasTime: this.hasTime, hasDraws: this.hasDraws, quantity: this.QUANTITY };
        if (!data.table) return false;
        const results = Array.from(data.table.results);
        const totalWeight = results.reduce((acc, r) => acc + r.weight, 0);
        const items = [];
        for (let result of results) {
            if (result.drawn) continue;
            let uuid = this.getResultUUID(result);
            if (!uuid) continue;
            const item = await fromUuid(uuid);
            if (!item) continue;
            const weight = (result.weight / totalWeight) * 100;
            item.tableWeight = weight.toFixed(2);
            if (game.modules.get("better-rolltables")?.active && data.table.getFlag("better-rolltables", "table-type") == "better") {
                const brtqQuantity = result.getFlag("better-rolltables", "brt-result-formula")?.formula;
                if (brtqQuantity) {
                    const brtqRoll = await new Roll(brtqQuantity).roll();
                    item.brtqQuantity = brtqRoll.total;
                }
            }
            items.push(item);
        }
        data.items = items;
        this._items = items;
        data.size = 100 - data.items.length * 2;
        return data;
    }

    getResultUUID(result) {
        return result.documentUuid;
    }

    async _onGather(consumeDraw = true, harvestActor = null, gatheringActor = null) {
        if (
            !Array.from(game.users)
                .filter((u) => u.active)
                .some((u) => u.isGM)
        )
            return ui.notifications.error(game.i18n.localize("gatherer.sheet.err.noGM"));
        const actor = gatheringActor ?? canvas?.tokens?.controlled[0]?.actor ?? game.user.character;
        if (!actor) return ui.notifications.error(game.i18n.localize("gatherer.sheet.err.noActor"));
        if (this.REQUIRE?.length) {
            for (let req of this.REQUIRE) {
                const item = actor.items.getName(req);
                if (!item) return ui.notifications.error(game.i18n.localize("gatherer.sheet.err.noReq") + req);
            }
        }
        if (this.TOOLDC && this.TOOL) {
            const item = actor.itemTypes?.tool?.find((t) => t.name === this.TOOL);
            if (!item) return ui.notifications.error(game.i18n.localize("gatherer.sheet.err.noReq") + this.TOOL);
        }
        const data = foundry.utils.mergeObject(this.defaultGathererData, this.object.getFlag("gatherer", "data") || {});
        if (this.hasDraws && data.drawsUsed >= this.MAX_DRAWS) {
            ui.notifications.error(game.i18n.localize("gatherer.sheet.err.noDraws"));
            return;
        }
        if (!data.firstDrawTime) {
            data.firstDrawTime = game.time.worldTime;
        }

        if (this.EXPRESSION) {
            const res = await this.evaluateExpression(actor);
            if (res === false) Socket.updateJournal({ uuid: this.object.uuid, drawsUsed: this.hasDraws ? data.drawsUsed + 1 : 0, firstDrawTime: this.hasTime ? data.firstDrawTime : 0, hasTime: this.hasTime, hasDraws: this.hasDraws }, { users: Socket.USERS.FIRSTGM });
            if (!res) return ui.notifications.warn(game.i18n.localize("gatherer.sheet.err.noExp"));
        }

        if (consumeDraw) Socket.updateJournal({
             uuid: this.object.uuid, drawsUsed: this.hasDraws ? data.drawsUsed + 1 : 0, firstDrawTime: this.hasTime ? data.firstDrawTime : 0, hasTime: this.hasTime, hasDraws: this.hasDraws }, { users: Socket.USERS.FIRSTGM });


        if (harvestActor) Socket.updateActor({ uuid: harvestActor.uuid }, { users: Socket.USERS.FIRSTGM});

        if (this.TOOLDC && this.TOOL && this.supportedSystem) {
            const item = actor.itemTypes?.tool?.find((t) => t.name === this.TOOL);
            const systemTool = actor.system.tools[this.TOOL];
            if (item || systemTool) {
                const roll = systemTool ? await actor.rollToolCheck({tool:this.TOOL}, {}) : await item.rollToolCheck({});
                if(!roll) return;
                if (roll[0].total < this.TOOLDC) {
                    ui.notifications.error(game.i18n.localize("gatherer.sheet.err.noExp"));
                    return;
                }
            }
        }

        if (this.SYSTEMABIL && this.supportedSystem && this.DC) {
            let result;
            if (game.dnd5e.config.abilities[this.SYSTEMABIL]) {
                result = await actor.rollAbilityCheck({ability: this.SYSTEMABIL}, {});
            } else {
                result = await actor.rollSkill({skill: this.SYSTEMABIL}, {});
            }
            result = result ? result[0] : {total: 0};
            if (result.total < this.DC) {
                ui.notifications.error(game.i18n.localize("gatherer.sheet.err.noExp"));
                return;
            }
        }

        const quantityRoll = await new Roll(this.QUANTITY).roll();
        //Execute gathering
        let items = await this.runMinigame();
        if (!items) {
            const result = await this.table.draw({ displayChat: false });
            items = [];
            for (let res of result.results) {
                const resItem = await fromUuid(this.getResultUUID(res));
                if (resItem) {
                    if (game.modules.get("better-rolltables")?.active && this.table.getFlag("better-rolltables", "table-type") == "better") {
                        const brtqQuantity = res.getFlag("better-rolltables", "brt-result-custom-quantity");
                        if (brtqQuantity) {
                            const brtqRoll = await new Roll(brtqQuantity).roll();
                            resItem.brtqQuantity = brtqRoll.total;
                        }
                    }
                    items.push(resItem);
                }
            }
        } else {
            const tableItem = Array.from(this.table.results).find((r) => r.documentId === items[0].id);
            if (tableItem) {
                if (game.modules.get("better-rolltables")?.active && this.table.getFlag("better-rolltables", "table-type") == "better") {
                    const brtqQuantity = tableItem.getFlag("better-rolltables", "brt-result-custom-quantity");
                    if (brtqQuantity) {
                        const brtqRoll = await new Roll(brtqQuantity).roll();
                        items[0].brtqQuantity = brtqRoll.total;
                    }
                }
            }
        }
        if (!items?.length) return ui.notifications.error(game.i18n.localize("gatherer.sheet.err.noItem"));
        let quantity = quantityRoll.total;

        const gatherData = {
            actor: actor,
            items: items,
            quantity: quantity,
        };

        Hooks.callAll("gathererGather", gatherData);

        quantity = gatherData.quantity;
        items = gatherData.items;
        const quantityPath = game.settings.get(MODULE_ID, "quantityPath");
        for (let item of items) {
            const previewsItem = actor.items.getName(item.name);
            if (previewsItem) {
                const currentQuantity = foundry.utils.getProperty(previewsItem.system, quantityPath);
                const updateData = { system: {} };
                foundry.utils.setProperty(updateData.system, quantityPath, currentQuantity + (item.brtqQuantity ?? quantity));
                await previewsItem.update(updateData);
            } else {
                const itemData = item.toObject();
                foundry.utils.setProperty(itemData.system, quantityPath, item.brtqQuantity ?? quantity);
                await actor.createEmbeddedDocuments("Item", [itemData]);
            }
        }
        this.toChat(items, quantity, actor);
    }

    async toChat(items, quantity, actor) {

        let content = `
        <strong>${actor.name} ${game.i18n.localize("gatherer.gathered")}:</strong>
        <div class="table-draw">
        <ul class="table-results">`;
        for (let item of items) {
            content += `<li class="table-result flexrow">
                <img class="result-image" src="${item.img}">
                <div class="result-text"><a class="content-link" draggable="true" data-uuid="${item.uuid}" data-id="${item.id}"><i class="fas fa-suitcase"></i>${item.name} X ${item.brtqQuantity ?? quantity}</a></div>
            </li>`;
        }
        content += `</ul>
        </div>`;

        ChatMessage.create(
            ChatMessage.applyRollMode(
                {
                    content: content,
                    speaker: { actor: actor.id },
                },
                game.settings.get("core", "rollMode"),
            ),
        );
        items.forEach((i) => delete i.brtqQuantity);
    }

    async evaluateExpression(actor) {
        const AsyncFunction = async function () {}.constructor;
        const fn = new AsyncFunction("actor", $("<span />", { html: this.EXPRESSION }).text());
        try {
            return await fn(actor);
        } catch (e) {
            ui.notifications.error("There was an error in your macro syntax. See the console (F12) for details");
            console.error(e);
            return false;
        }
    }

    async runMinigame() {
        if (!this.MINIGAME) return false;
        const items = this._items;
        let minigameTime = this.MINIGAME;
        let currentItem = null;
        let minigameCompleted = false;
        async function wait(ms) {
            return new Promise((resolve) => {
                setTimeout(resolve, ms);
            });
        }
        return new Promise(async (resolve, reject) => {
            const dialog = new Dialog({
                title: game.i18n.localize("gatherer.minigame.title"),
                content: `<div class="gatherer-minigame"><div class="gatherer-minigame-item" style="background-image: url('${items[0].img}')"></div></div>`,
                buttons: {
                    confirm: {
                        label: '<i class="fas fa-leaf"></i> ' + game.i18n.localize("gatherer.sheet.gather"),
                        callback: function () {
                            minigameCompleted = true;
                            resolve([currentItem]);
                        },
                    },
                },
                height: 400,
                default: "confirm",
                close: function () {
                    resolve(false);
                    minigameCompleted = true;
                },
                render: (html) => {},
            });
            Hooks.once("renderDialog", (dialog, html) => {
                html.closest(".window-app").css({ width: "250px" });
            });
            dialog.render(true);
            while (!minigameCompleted) {
                const dhtml = dialog.element.find(".gatherer-minigame");
                dhtml.empty();
                const index = Math.floor(Math.random() * items.length);
                let randomItem = items[index];
                if (randomItem == currentItem) randomItem = items[(index + 1) % items.length];
                currentItem = randomItem;
                const html = $(`<div class="gatherer-minigame-item" style="background-image: url('${randomItem.img}')"></div>`);
                dhtml.append(html);
                await wait((parseFloat(randomItem.tableWeight) / 100) * minigameTime);
                minigameTime *= 0.99;
            }
        });
    }

    async _onReset(force = false) {
        const data = foundry.utils.mergeObject(this.defaultGathererData, this.object.getFlag("gatherer", "data") || {});
        const timeDiff = game.time.worldTime - data.firstDrawTime;
        if (force || (this.hasTime && timeDiff * 1000 >= this.TIMEMS)) {
            Socket.updateJournal( { uuid: this.object.uuid, firstDrawTime: game.time.worldTime, drawsUsed: 0 }, { users: Socket.USERS.FIRSTGM });
        }
    }

    parseMStoTime(ms) {
        const time = new Date(ms);
        let hrs = time.getUTCHours();
        let mins = time.getUTCMinutes();
        let days = time.getUTCDate() - 1;
        return `${days}d ${hrs}h ${mins}m`;
    }

    async rollQuantity() {
        const formula = this.QUANTITY;
        if (!formula) return 1;
        const roll = new Roll(formula);
        await roll.evaluate({ async: true });
        return roll.total;
    }

    get TOOL() {
        return this._gathererData?.toolCheck;
    }

    get TOOLDC() {
        return this._gathererData?.toolDC;
    }

    get SYSTEMABIL() {
        return this._gathererData?.systemAbil;
    }

    get DC() {
        return this._gathererData?.DC;
    }

    get TIME() {
        return parseFloat(this._gathererData?.time) ?? 0;
    }

    get TIMEMS() {
        const hours = this.TIME;
        return hours * 60 * 60 * 1000;
    }

    get QUANTITY() {
        return this._gathererData?.quantity || "1";
    }

    get hasTime() {
        return this.TIME > 0;
    }

    get hasDraws() {
        return this.MAX_DRAWS > 0;
    }

    get MAX_DRAWS() {
        return parseInt(this._gathererData?.draws) ?? 0;
    }

    get MINIGAME() {
        return this._gathererData?.minigame || false;
    }

    get REQUIRE() {
        return (this._gathererData?.require ?? "")
            .split(",")
            .map((i) => i.trim())
            .filter((i) => i);
    }

    get EXPRESSION() {
        const macroExpression = game.macros.getName(this._gathererData?.expression)?.command;
        return macroExpression ?? this._gathererData?.expression ?? false;
    }

    get table() {
        return this._gathererData?.table ?? false;
    }

    get supportedSystem() {
        return this.getSystemData() != null;
    }

    get defaultGathererData() {
        return {
            drawsUsed: 0,
            firstDrawTime: 0,
        };
    }

    static _lastTime = 0;

    static _onUpdateWorldTime() {
        const now = game.time.worldTime;
        if (Math.abs(now - this._lastTime) > 60) {
            this._lastTime = now;
            console.log("Gatherer: Updating journals");
            Object.values(ui.windows)
                .filter((w) => w instanceof JournalSheet)
                .forEach((j) => {
                    if (j.element.find(".gatherer-container").length) j.render(true);
                });
        }
    }
}

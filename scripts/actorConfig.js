import { MODULE_ID } from "./main.js";

export class GathererActorConfig extends FormApplication {
    constructor(document) {
        super();
        this.document = document;
    }

    static get APP_ID() {
        return this.name
            .split(/(?=[A-Z])/)
            .join("-")
            .toLowerCase();
    }

    get APP_ID() {
        return this.constructor.APP_ID;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: this.APP_ID,
            template: `modules/${MODULE_ID}/templates/${this.APP_ID}.hbs`,
            popOut: true,
            minimizable: true,
            width: 400,
            title: game.i18n.localize(`${MODULE_ID}.${this.APP_ID}.title`),
            closeOnSubmit: true,
        });
    }

    async getData() {
        return { actor: this.document };
    }

    activateListeners(html) {
        super.activateListeners(html);
        html = html[0] ?? html;
        html.querySelector("#gatherSheet").addEventListener("drop", this._onDrop.bind(this));
    }

    async _onDrop(event) {
        try {
            const data = JSON.parse(event.dataTransfer.getData("text/plain"));
            const document = await fromUuid(data.uuid);
            const sheetClass = document.getFlag("core", "sheetClass");
            if (sheetClass !== "gatherer.GathererSheet") {
                return ui.notifications.error(game.i18n.localize(`${MODULE_ID}.error.notGatherer`));
            } else {
                event.currentTarget.value = data.uuid;
            }
        } catch (e) {
            return;
        }
    }

    async _updateObject(event, formData) {
        formData = foundry.utils.expandObject(formData);
        return this.document.update(formData);
    }
}

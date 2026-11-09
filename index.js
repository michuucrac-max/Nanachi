
import { Buffer } from "node:buffer";

const OWNER = process.env.GITHUB_OWNER || "michuucrac-max";
const REPO = process.env.GITHUB_REPO || "Nanachi";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const TOKEN = process.env.GITHUB_TOKEN;

const API = `https://api.github.com/repos/${OWNER}/${REPO}/contents`;

const DEFAULTS = {
    "data/knowledge.json": {
        version: 1,
        updatedAt: null,
        items: []
    },

    "data/human_training.jsonl": "\n",
    "data/ai_training.jsonl": "\n",
    "data/corrections.jsonl": "\n",

    "data/training_history.json": {
        version: 1,
        events: []
    }
};

export class GitHubMemory {

    constructor() {
        this.data = {};
        this.dirty = new Set();
        this.timer = null;
        this.queue = Promise.resolve();
        this.loaded = false;
    }

    headers() {
        if (!TOKEN) {
            throw new Error("Falta GITHUB_TOKEN en Render.");
        }

        return {
            "Authorization": `Bearer ${TOKEN}`,
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json"
        };
    }

    url(path) {
        const encoded = path
            .split("/")
            .map(encodeURIComponent)
            .join("/");

        return `${API}/${encoded}`;
    }

    async getRemote(path) {
        const response = await fetch(
            `${this.url(path)}?ref=${encodeURIComponent(BRANCH)}`,
            { headers: this.headers() }
        );

        if (response.status === 404) return null;

        if (!response.ok) {
            throw new Error(
                `GitHub GET ${path}: ${response.status} ${await response.text()}`
            );
        }

        const result = await response.json();

        return {
            sha: result.sha,
            content: Buffer.from(
                result.content.replace(/\n/g, ""),
                "base64"
            ).toString("utf8")
        };
    }

    async writeRemote(path, content) {
        for (let attempt = 0; attempt < 3; attempt++) {

            const current = await this.getRemote(path);

            const body = {
                message: `Nanachi AutoSave: ${path}`,
                content: Buffer.from(content, "utf8").toString("base64"),
                branch: BRANCH
            };

            if (current) {
                body.sha = current.sha;
            }

            const response = await fetch(this.url(path), {
                method: "PUT",
                headers: this.headers(),
                body: JSON.stringify(body)
            });

            if (response.ok) {
                console.log(`[GITHUB] Guardado: ${path}`);
                return;
            }

            const errorText = await response.text();

            if (
                (response.status === 409 || response.status === 422) &&
                attempt < 2
            ) {
                console.warn(`[GITHUB] Conflicto en ${path}, reintentando.`);
                continue;
            }

            throw new Error(
                `GitHub PUT ${path}: ${response.status} ${errorText}`
            );
        }
    }

    parse(path, content) {
        if (path.endsWith(".jsonl")) {
            return content
                .split("\n")
                .filter(Boolean)
                .map(line => JSON.parse(line));
        }

        return JSON.parse(content);
    }

    serialize(path, value) {
        if (path.endsWith(".jsonl")) {
            return value.map(item => JSON.stringify(item)).join("\n")
                + (value.length ? "\n" : "");
        }

        return JSON.stringify(value, null, 2) + "\n";
    }

    async load() {
        console.log("[NANACHI] Recuperando memoria de GitHub...");

        for (const [path, defaultValue] of Object.entries(DEFAULTS)) {

            let remote = await this.getRemote(path);

            if (!remote) {
                console.log(`[NANACHI] Creando ${path}`);

                await this.writeRemote(
                    path,
                    this.serialize(
                        path,
                        path.endsWith(".jsonl") ? [] : defaultValue
                    )
                );

                remote = await this.getRemote(path);
            }

            if (!remote) {
                throw new Error(`No se pudo inicializar ${path}`);
            }

            this.data[path] = this.parse(path, remote.content);

            console.log(`[NANACHI] Memoria cargada: ${path}`);
        }

        this.loaded = true;

        console.log("[NANACHI] Memoria recuperada correctamente.");

        return this;
    }

    append(path, entry) {
        if (!this.loaded) {
            throw new Error("La memoria todavía no está cargada.");
        }

        if (!path.endsWith(".jsonl")) {
            throw new Error("append solo admite archivos JSONL.");
        }

        if (!this.data[path]) {
            throw new Error(`Archivo de memoria desconocido: ${path}`);
        }

        this.data[path].push({
            ...entry,
            savedAt: new Date().toISOString()
        });

        this.markDirty(path);
    }

    addKnowledge(entry) {
        if (!this.loaded) {
            throw new Error("La memoria todavía no está cargada.");
        }

        const path = "data/knowledge.json";

        this.data[path].items.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            ...entry,
            createdAt: new Date().toISOString()
        });

        this.data[path].updatedAt = new Date().toISOString();

        this.markDirty(path);
    }

    addHistory(event) {
        const path = "data/training_history.json";

        this.data[path].events.push({
            ...event,
            date: new Date().toISOString()
        });

        this.markDirty(path);
    }

    markDirty(path) {
        this.dirty.add(path);

        clearTimeout(this.timer);

        this.timer = setTimeout(() => {
            this.save().catch(error => {
                console.error("[AUTOSAVE]", error);
            });
        }, 5000);
    }

    save() {
        this.queue = this.queue.then(async () => {

            if (!this.loaded || this.dirty.size === 0) return;

            const paths = [...this.dirty];

            for (const path of paths) {

                const snapshot = this.serialize(
                    path,
                    this.data[path]
                );

                await this.writeRemote(path, snapshot);

                // Solo limpiar si no hubo cambios durante el guardado.
                if (
                    this.serialize(path, this.data[path]) === snapshot
                ) {
                    this.dirty.delete(path);
                }
            }

        });

        return this.queue;
    }

    async close() {
        clearTimeout(this.timer);
        await this.save();
    }

            }

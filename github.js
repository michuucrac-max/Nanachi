
const API = "https://api.github.com";

const owner = process.env.GITHUB_OWNER;
const repo = process.env.GITHUB_REPO;
const branch = process.env.GITHUB_BRANCH || "main";

async function request(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
        ...options,
        headers: {
            "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
            ...options.headers
        }
    });

    if (!response.ok) {
        throw new Error(
            `GitHub API ${response.status}: ${await response.text()}`
        );
    }

    return response.json();
}

export async function readFile(path) {
    const encodedPath = path.split("/")
        .map(encodeURIComponent)
        .join("/");

    try {
        const file = await request(
            `/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`
        );

        return {
            content: Buffer.from(file.content, "base64").toString("utf8"),
            sha: file.sha
        };
    } catch (error) {
        if (error.message.includes("GitHub API 404")) {
            return { content: "", sha: null };
        }

        throw error;
    }
}

export async function writeFile(path, content, message) {
    const current = await readFile(path);

    const encodedPath = path.split("/")
        .map(encodeURIComponent)
        .join("/");

    const body = {
        message,
        content: Buffer.from(content, "utf8").toString("base64"),
        branch
    };

    if (current.sha) {
        body.sha = current.sha;
    }

    return request(
        `/repos/${owner}/${repo}/contents/${encodedPath}`,
        {
            method: "PUT",
            body: JSON.stringify(body)
        }
    );
}

export async function appendJSONL(path, entry) {
    const current = await readFile(path);

    const line = JSON.stringify(entry);

    const updated = current.content
        ? `${current.content.trimEnd()}\n${line}\n`
        : `${line}\n`;

    return writeFile(
        path,
        updated,
        `CandyCat AI: aprendizaje ${path}`
    );
}

export async function appendKnowledge(entry) {
    const current = await readFile("knowledge.json");

    let knowledge = [];

    if (current.content) {
        knowledge = JSON.parse(current.content);
    }

    if (knowledge.some(item => item.id === entry.id)) {
        return;
    }

    knowledge.push(entry);

    return writeFile(
        "knowledge.json",
        JSON.stringify(knowledge, null, 2),
        "CandyCat AI: nuevo conocimiento"
    );
}

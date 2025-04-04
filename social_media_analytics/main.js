const express = require("express");
const axios = require("axios");
require("dotenv").config();
const NodeCache = require("node-cache");

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL;
const AUTH_TOKEN = process.env.AUTH_TOKEN;

const cache = new NodeCache({ stdTTL: 60 }); // 60 sec

const apiClient = axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${AUTH_TOKEN}` }
});

// Helper fnc
async function fetchData(endpoint, key) {
    const saved = cache.get(key);
    if (saved) return saved;

    const res = await apiClient.get(endpoint);
    const data = res.data;
    if (!data || typeof data !== "object") throw new Error(`Invalid response from ${endpoint}`);

    cache.set(key, data);
    return data;
}

async function getAllUsers() {
    const data = await fetchData("/users", "users");
    const users = data.users || {};
    return Object.entries(users).map(([id, name]) => ({
        id: parseInt(id),
        name
    }));
}

async function getAllPostsByUsers() {
    const saved = cache.get("user_posts");
    if (saved) return saved;

    const users = await getAllUsers();

    const postsList = await Promise.all(
        users.map(async (user) => {
            try {
                const data = await fetchData(`/users/${user.id}/posts`, `posts_${user.id}`);
                return {
                    userId: user.id,
                    name: user.name,
                    posts: data.posts || []
                };
            } catch {
                return { userId: user.id, name: user.name, posts: [] };
            }
        })
    );

    cache.set("user_posts", postsList);
    return postsList;
}

async function getComments(postId) {
    try {
        const data = await apiClient.get(`/posts/${postId}/comments`);
        return data.data.comments || [];
    } catch {
        return [];
    }
}

app.get("/users", async (req, res) => {
    try {
        const postsByUsers = await getAllPostsByUsers();

        const topUsers = postsByUsers
            .map(user => ({
                userId: user.userId,
                name: user.name,
                postCount: user.posts.length
            }))
            .sort((a, b) => b.postCount - a.postCount)
            .slice(0, 5);

        res.json({ topUsers });
    } catch (err) {
        res.status(500).json({ error: "Error getting top users", details: err.message });
    }
});

// GET 5 posts
app.get("/posts", async (req, res) => {
    const { type } = req.query;

    if (!["latest", "popular"].includes(type)) {
        return res.status(400).json({
            error: "Please provide type as 'latest' or 'popular'"
        });
    }

    try {
        const postsByUsers = await getAllPostsByUsers();
        const allPosts = postsByUsers.flatMap(user => user.posts);

        if (type === "latest") {
            const latestPosts = allPosts
                .sort((a, b) => b.id - a.id)
                .slice(0, 5);
            return res.json(latestPosts);
        }

        if (type === "popular") {
            const postsWithComments = await Promise.all(
                allPosts.map(async (post) => {
                    const comments = await getComments(post.id);
                    return { ...post, commentCount: comments.length };
                })
            );

            const topPopularPosts = postsWithComments
                .sort((a, b) => b.commentCount - a.commentCount)
                .slice(0, 5);

            return res.json(topPopularPosts);
        }
    } catch (err) {
        res.status(500).json({ error: "Error getting posts", details: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

require('dotenv').config();
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const port = process.env.PORT || 3001;

let cachedPosts = [];
let lastFetchTime = null;
const CACHE_DURATION = 20 * 60 * 1000; 
const POSTS_PER_PAGE = 10;

async function fetchAllPosts(username) {
    let allPosts = [];
    let currentPage = 1;
    let hasMore = true;

    while (hasMore) {
        try {
            const response = await fetch(
                `https://www.tabnews.com.br/api/v1/contents/${username}?page=${currentPage}&per_page=100&strategy=relevant`
            );
            const posts = await response.json();
            
            if (posts.length === 0) {
                hasMore = false;
            } else {
                allPosts = allPosts.concat(posts.filter(post => post.title));
                currentPage++;
            }
        } catch (error) {
            console.error('Error fetching posts:', error);
            hasMore = false;
        }
    }

    return allPosts;
}

async function updateCache() {
    try {
        const username = process.env.TABNEWS_USERNAME || 'filipedeschamps';
        cachedPosts = await fetchAllPosts(username);
        lastFetchTime = Date.now();
        console.log(`Cache updated with ${cachedPosts.length} posts`);
    } catch (error) {
        console.error('Error updating cache:', error);
    }
}

updateCache();

setInterval(updateCache, CACHE_DURATION);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/main');

app.use(expressLayouts);
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', async (req, res) => {
    try {
        const username = process.env.TABNEWS_USERNAME || 'filipedeschamps';
        const page = parseInt(req.query.page) || 1;
        
        const startIndex = (page - 1) * POSTS_PER_PAGE;
        const endIndex = startIndex + POSTS_PER_PAGE;
        const totalPages = Math.ceil(cachedPosts.length / POSTS_PER_PAGE);
        
        const paginatedPosts = cachedPosts.slice(startIndex, endIndex);
        
        res.render('index', { 
            posts: paginatedPosts,
            username: username,
            currentPage: page,
            totalPages: totalPages,
            perPage: POSTS_PER_PAGE
        });
    } catch (error) {
        console.error('Error serving posts:', error);
        res.render('index', { 
            posts: [], 
            username: process.env.TABNEWS_USERNAME,
            currentPage: 1,
            totalPages: 1,
            perPage: POSTS_PER_PAGE
        });
    }
});

app.listen(port, () => {
    console.log(`MiniTabnews running at http://localhost:${port}`);
}); 
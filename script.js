const API_KEY = '8265bd1679663a7ea12ac168da84d2e8'; // Free TMDB API key
const API_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';
const BACKDROP_URL = 'https://image.tmdb.org/t/p/original';

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const results = document.getElementById('results');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const typeFilter = document.getElementById('typeFilter');
const yearFilter = document.getElementById('yearFilter');
const languageFilter = document.getElementById('languageFilter');

let favorites = JSON.parse(localStorage.getItem('movieFavorites')) || [];
let searchHistory = JSON.parse(localStorage.getItem('movieHistory')) || [];

const currentYear = new Date().getFullYear();
for (let year = currentYear; year >= 1900; year--) {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    yearFilter.appendChild(option);
}

updateFavCount();

searchBtn.addEventListener('click', () => searchMovies());
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchMovies();
});

searchInput.addEventListener('input', async (e) => {
    const query = e.target.value.trim();
    const suggestionsDiv = document.getElementById('suggestions');
    
    if (query.length < 2) {
        suggestionsDiv.classList.add('hidden');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}`);
        const data = await response.json();
        const results = data.results.filter(item => item.media_type !== 'person').slice(0, 5);
        
        if (results.length > 0) {
            suggestionsDiv.innerHTML = results.map(item => {
                const title = item.title || item.name;
                const year = (item.release_date || item.first_air_date || '').split('-')[0];
                return `<div class="suggestion-item" onclick="selectSuggestion('${title.replace(/'/g, "\\'")}')"><strong>${title}</strong> ${year ? `(${year})` : ''}</div>`;
            }).join('');
            suggestionsDiv.classList.remove('hidden');
        } else {
            suggestionsDiv.classList.add('hidden');
        }
    } catch (err) {
        suggestionsDiv.classList.add('hidden');
    }
});

function selectSuggestion(title) {
    searchInput.value = title;
    document.getElementById('suggestions').classList.add('hidden');
    searchMovies();
}

function quickSearch(query) {
    searchInput.value = query;
    searchMovies();
}

async function searchMovies() {
    const query = searchInput.value.trim();
    if (!query) return;

    addToHistory(query);
    loading.classList.remove('hidden');
    error.classList.add('hidden');
    results.innerHTML = '';

    try {
        const type = typeFilter.value;
        const year = yearFilter.value;
        const language = languageFilter.value;

        let url = `${API_URL}/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}`;
        if (language) url += `&language=${language}`;

        const response = await fetch(url);
        const data = await response.json();

        let filteredResults = data.results.filter(item => item.media_type !== 'person');
        
        if (type === 'movie') {
            filteredResults = filteredResults.filter(item => item.media_type === 'movie');
        } else if (type === 'series') {
            filteredResults = filteredResults.filter(item => item.media_type === 'tv');
        }

        if (year) {
            filteredResults = filteredResults.filter(item => {
                const itemYear = (item.release_date || item.first_air_date || '').split('-')[0];
                return itemYear === year;
            });
        }

        if (filteredResults.length === 0) {
            showError('No movies found. Try different keywords.');
            return;
        }

        displayResults(filteredResults);
    } catch (err) {
        showError('Failed to fetch movies. Please check your internet connection.');
    } finally {
        loading.classList.add('hidden');
    }
}

function displayResults(movies) {
    results.innerHTML = movies.map(movie => {
        const title = movie.title || movie.name;
        const date = movie.release_date || movie.first_air_date || 'N/A';
        const poster = movie.poster_path ? IMG_URL + movie.poster_path : 'https://via.placeholder.com/300x450?text=No+Image';
        const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
        const isFav = favorites.some(f => f.id === movie.id);

        return `
            <div class="movie-card" onclick="showDetails(${movie.id}, '${movie.media_type}')">
                <img src="${poster}" alt="${title}" loading="lazy">
                <div class="movie-info">
                    <h3>${title}</h3>
                    <div class="movie-meta">
                        <span class="rating">⭐ ${rating}</span>
                        <span>${date.split('-')[0]}</span>
                    </div>
                </div>
                <button class="btn-fav ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite(${JSON.stringify(movie).replace(/"/g, '&quot;')})">
                    ${isFav ? '❤️' : '🤍'}
                </button>
            </div>
        `;
    }).join('');
}

async function showDetails(id, type) {
    loading.classList.remove('hidden');
    
    try {
        const mediaType = type === 'tv' ? 'tv' : 'movie';
        const response = await fetch(`${API_URL}/${mediaType}/${id}?api_key=${API_KEY}&append_to_response=credits,videos,images`);
        const movie = await response.json();

        const title = movie.title || movie.name;
        const poster = movie.poster_path ? IMG_URL + movie.poster_path : 'https://via.placeholder.com/300x450?text=No+Image';
        const backdrop = movie.backdrop_path ? BACKDROP_URL + movie.backdrop_path : '';
        const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
        const date = movie.release_date || movie.first_air_date || 'N/A';
        const runtime = movie.runtime ? `${movie.runtime} min` : movie.number_of_seasons ? `${movie.number_of_seasons} Seasons` : 'N/A';
        const genres = movie.genres ? movie.genres.map(g => g.name).join(', ') : 'N/A';
        const cast = movie.credits?.cast ? movie.credits.cast.slice(0, 5).map(c => c.name).join(', ') : 'N/A';
        const director = movie.credits?.crew ? movie.credits.crew.find(c => c.job === 'Director')?.name || 'N/A' : 'N/A';
        const trailer = movie.videos?.results ? movie.videos.results.find(v => v.type === 'Trailer') : null;
        const images = movie.images?.backdrops ? movie.images.backdrops.slice(0, 6) : [];

        let imagesHTML = '';
        if (images.length > 0) {
            imagesHTML = `
                <div class="movie-images">
                    <h3>Images</h3>
                    <div class="images-grid">
                        ${images.map(img => `
                            <img src="${IMG_URL}${img.file_path}" alt="Movie scene" loading="lazy">
                        `).join('')}
                    </div>
                </div>
            `;
        }

        document.getElementById('movieDetails').innerHTML = `
            ${backdrop ? `<div class="backdrop" style="background-image: url(${backdrop})"></div>` : ''}
            <div class="details-content">
                <img src="${poster}" alt="${title}" class="details-poster">
                <div class="details-info">
                    <h2>${title}</h2>
                    <div class="details-meta">
                        <span class="rating">⭐ ${rating}/10</span>
                        <span>📅 ${date}</span>
                        <span>⏱️ ${runtime}</span>
                    </div>
                    <p class="genres">🎭 ${genres}</p>
                    <p class="overview">${movie.overview || 'No overview available.'}</p>
                    <p class="cast"><strong>Director:</strong> ${director}</p>
                    <p class="cast"><strong>Cast:</strong> ${cast}</p>
                    <p class="cast"><strong>Language:</strong> ${movie.original_language?.toUpperCase() || 'N/A'}</p>
                    ${movie.vote_count ? `<p class="cast"><strong>Votes:</strong> ${movie.vote_count.toLocaleString()}</p>` : ''}
                    <div class="btn-group">
                        ${trailer ? `<a href="https://www.youtube.com/watch?v=${trailer.key}" target="_blank" class="btn-trailer">▶️ Watch Trailer</a>` : ''}
                        ${movie.homepage ? `<a href="${movie.homepage}" target="_blank" class="btn-trailer">Official Website</a>` : ''}
                    </div>
                </div>
            </div>
            ${imagesHTML}
        `;

        document.getElementById('modal').classList.add('active');
    } catch (err) {
        showError('Failed to load movie details.');
    } finally {
        loading.classList.add('hidden');
    }
}

function toggleFavorite(movie) {
    const index = favorites.findIndex(f => f.id === movie.id);
    
    if (index > -1) {
        favorites.splice(index, 1);
    } else {
        favorites.push(movie);
    }
    
    localStorage.setItem('movieFavorites', JSON.stringify(favorites));
    updateFavCount();
    
    if (results.innerHTML) {
        searchMovies();
    }
}

function showFavorites() {
    if (favorites.length === 0) {
        document.getElementById('favoritesList').innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">No favorites yet. Add some movies!</p>';
    } else {
        document.getElementById('favoritesList').innerHTML = `
            <div class="results-grid">
                ${favorites.map(movie => {
                    const title = movie.title || movie.name;
                    const poster = movie.poster_path ? IMG_URL + movie.poster_path : 'https://via.placeholder.com/300x450?text=No+Image';
                    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
                    
                    return `
                        <div class="movie-card" onclick="showDetails(${movie.id}, '${movie.media_type}')">
                            <img src="${poster}" alt="${title}" loading="lazy">
                            <div class="movie-info">
                                <h3>${title}</h3>
                                <div class="movie-meta">
                                    <span class="rating">⭐ ${rating}</span>
                                </div>
                            </div>
                            <button class="btn-fav active" onclick="event.stopPropagation(); toggleFavorite(${JSON.stringify(movie).replace(/"/g, '&quot;')})">❤️</button>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
    
    document.getElementById('favoritesModal').classList.add('active');
}

function showHistory() {
    if (searchHistory.length === 0) {
        document.getElementById('historyList').innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">No search history.</p>';
    } else {
        document.getElementById('historyList').innerHTML = searchHistory.map(term => `
            <div class="history-item" onclick="searchFromHistory('${term}')">
                <span>🔍 ${term}</span>
            </div>
        `).join('');
    }
    
    document.getElementById('historyModal').classList.add('active');
}

function searchFromHistory(term) {
    searchInput.value = term;
    closeHistoryModal();
    searchMovies();
}

function addToHistory(term) {
    searchHistory = searchHistory.filter(t => t !== term);
    searchHistory.unshift(term);
    searchHistory = searchHistory.slice(0, 20);
    localStorage.setItem('movieHistory', JSON.stringify(searchHistory));
}

function clearHistory() {
    if (confirm('Clear all search history?')) {
        searchHistory = [];
        localStorage.removeItem('movieHistory');
        closeHistoryModal();
    }
}

function updateFavCount() {
    document.getElementById('favCount').textContent = favorites.length;
}

function showError(message) {
    error.textContent = message;
    error.classList.remove('hidden');
    setTimeout(() => error.classList.add('hidden'), 5000);
}

function closeModal() {
    document.getElementById('modal').classList.remove('active');
}

function closeFavoritesModal() {
    document.getElementById('favoritesModal').classList.remove('active');
}

function closeHistoryModal() {
    document.getElementById('historyModal').classList.remove('active');
}

window.addEventListener('DOMContentLoaded', async () => {
    loading.classList.remove('hidden');
    try {
        const response = await fetch(`${API_URL}/trending/all/week?api_key=${API_KEY}`);
        const data = await response.json();
        displayResults(data.results.filter(item => item.media_type !== 'person'));
    } catch (err) {
        showError('Failed to load trending movies.');
    } finally {
        loading.classList.add('hidden');
    }
});

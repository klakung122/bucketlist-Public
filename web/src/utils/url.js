// src/utils/url.js
export function absolutize(url) {
    if (!url) return url;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${process.env.NEXT_PUBLIC_API_URL}${url}`;
}
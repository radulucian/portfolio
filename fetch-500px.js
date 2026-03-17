const https = require("https");
const fs = require("fs");
const path = require("path");

const USERNAME = "raduthlucian";
const PHOTO_COUNT = 50;

function graphqlPost(query) {
  const body = JSON.stringify({ query });
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.500px.com",
        path: "/graphql",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": "Mozilla/5.0",
          Origin: "https://500px.com",
          Referer: "https://500px.com/",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (json.errors) {
              reject(new Error(JSON.stringify(json.errors)));
            } else {
              resolve(json.data);
            }
          } catch (e) {
            reject(new Error(`Parse error: ${data.slice(0, 300)}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log(`Fetching photos for ${USERNAME} from 500px GraphQL API...`);

  const query = `{
    userByUsername(username: "${USERNAME}") {
      id
      displayName
      photos(first: ${PHOTO_COUNT}) {
        totalCount
        edges {
          node {
            id
            legacyId
            canonicalPath
            name
            description
            width
            height
            category
            aperture
            shutterSpeed
            iso
            focalLength
            camera { rawName }
            lens { rawName }
            location
            tags
            images(sizes: [600, 1080, 2048]) { url size }
          }
        }
      }
    }
  }`;

  try {
    const data = await graphqlPost(query);
    const user = data.userByUsername;
    const photos = user.photos;

    console.log(`Profile: ${user.displayName}`);
    console.log(`Total photos: ${photos.totalCount}`);
    console.log(`Fetched: ${photos.edges.length}`);

    const output = {
      username: USERNAME,
      displayName: user.displayName,
      profileUrl: `https://500px.com/${USERNAME}`,
      fetchedAt: new Date().toISOString(),
      totalCount: photos.totalCount,
      photos: photos.edges.map((e) => {
        const n = e.node;
        const imgs = {};
        (n.images || []).forEach((img) => (imgs[img.size] = img.url));
        return {
          id: n.legacyId,
          name: n.name || "Untitled",
          description: n.description || "",
          width: n.width,
          height: n.height,
          category: n.category,
          url: n.canonicalPath
            ? `https://500px.com${n.canonicalPath}`
            : `https://500px.com/photo/${n.legacyId}`,
          aperture: n.aperture,
          shutterSpeed: n.shutterSpeed,
          iso: n.iso,
          focalLength: n.focalLength,
          camera: n.camera?.rawName || null,
          lens: n.lens?.rawName || null,
          location: n.location,
          tags: n.tags || [],
          images: imgs,
        };
      }),
    };

    const outPath = path.join(__dirname, "500px-photos.json");
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
    console.log(`\nSaved to ${outPath}`);

    const cats = {};
    output.photos.forEach((p) => {
      const c = p.category || "UNCATEGORIZED";
      cats[c] = (cats[c] || 0) + 1;
    });
    console.log("\nCategories:");
    Object.entries(cats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, count]) => console.log(`  ${cat}: ${count}`));
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

main();

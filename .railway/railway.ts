import { bucket, defineRailway, github, postgres, project, redis, service } from "railway/iac";

export default defineRailway(() => {
  const db = postgres("Postgres");
  const cache = redis("Redis");
  const files = bucket("cas-files");
  const repo = github("qiamit/Finance_Management", { branch: "main" });

  const api = service("api", {
    source: repo,
    build: "npm install && npm run build:api",
    start: "npm run start -w @fm/api",
    env: {
      DATABASE_URL: db.env.DATABASE_URL,
      REDIS_URL: cache.env.REDIS_URL,
      REDIS_PRIVATE_URL: cache.env.REDIS_PRIVATE_URL,
      S3_ENDPOINT: files.env.ENDPOINT,
      S3_ACCESS_KEY_ID: files.env.ACCESS_KEY_ID,
      S3_SECRET_ACCESS_KEY: files.env.SECRET_ACCESS_KEY,
      S3_BUCKET: files.env.BUCKET,
      S3_REGION: "auto",
      S3_FORCE_PATH_STYLE: "true",
      NODE_ENV: "production",
      COOKIE_CROSS_SITE: "true",
    },
  });

  const worker = service("worker", {
    source: repo,
    build: "npm install && npm run build:api",
    start: "npm run start:worker -w @fm/api",
    env: {
      DATABASE_URL: db.env.DATABASE_URL,
      REDIS_URL: cache.env.REDIS_URL,
      REDIS_PRIVATE_URL: cache.env.REDIS_PRIVATE_URL,
      S3_ENDPOINT: files.env.ENDPOINT,
      S3_ACCESS_KEY_ID: files.env.ACCESS_KEY_ID,
      S3_SECRET_ACCESS_KEY: files.env.SECRET_ACCESS_KEY,
      S3_BUCKET: files.env.BUCKET,
      S3_REGION: "auto",
      S3_FORCE_PATH_STYLE: "true",
      NODE_ENV: "production",
    },
  });

  const web = service("web", {
    source: repo,
    build: "npm install && npm run build -w @fm/shared && npm run build -w @fm/web",
    start: "npm run start -w @fm/web",
    env: {
      API_URL: api.env.RAILWAY_PUBLIC_DOMAIN,
    },
  });

  return project("Finance Management", {
    resources: [db, cache, files, api, worker, web],
  });
});

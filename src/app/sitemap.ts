import { getAllResumeIds } from "@/lib/resume";
import { website } from "@/lib/website";
import type { MetadataRoute } from "next";
import { getPaths, getTags } from "@/lib/data/articles";

export const revalidate = 5;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const resumeEntries: MetadataRoute.Sitemap = getAllResumeIds().map((id) => ({
    url: `${website.url}/resume/${id}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  const sitemap: MetadataRoute.Sitemap = [
    {
      url: `${website.url}`,
      lastModified: new Date(),
      changeFrequency: "always",
      priority: 1,
    },
    {
      url: `${website.url}/resume`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${website.url}/resume/all`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${website.url}/articles`,
      lastModified: new Date(),
      changeFrequency: "always",
      priority: 1,
    },
    ...resumeEntries,
  ];

  const articles = await getPaths();
  const tags = await getTags();

  articles.forEach((article) => {
    sitemap.push({
      url: `${website.url}/articles/${article}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    });
  });
  tags.forEach((tag) => {
    sitemap.push({
      url: `${website.url}/articles?tag=${tag}`,
      lastModified: new Date(),
      changeFrequency: "always",
      priority: 0.5,
    });
  });

  return sitemap;
}

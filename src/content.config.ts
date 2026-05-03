import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const articulos = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/articulos" }),
  schema: ({ image }) => z.object({
    title: z.string(),
    fecha: z.date(),
    autor: z.string().default("Dr. Alejandro J. Gómez Betancourt"),
    resumen: z.string().min(80).max(400),
    imagen: image().optional(),
    imagenAlt: z.string(),
    tiempoLectura: z.number().int().positive(),
    tags: z.array(z.string()),
    publicado: z.boolean().default(true),
  }),
});

const TERRITORIOS = ["talent-acquisition", "employee-experience", "leadership-performance", "culture-change"] as const;

const servicios = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/servicios" }),
  schema: z.object({
    titulo_es: z.string(),
    titulo_en: z.string(),
    territorio: z.enum(TERRITORIOS),
    orden: z.number().int(),
    resumen_es: z.string(),
    resumen_en: z.string(),
    herramientas: z.array(z.string()).optional(),
    publicado: z.boolean().default(true),
  }),
});

const valores = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/valores" }),
  schema: z.object({
    nombre_es: z.string(),
    nombre_en: z.string(),
    orden: z.number().int(),
    descripcion_es: z.string(),
    descripcion_en: z.string(),
  }),
});

export const collections = { articulos, servicios, valores };

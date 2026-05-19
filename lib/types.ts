import type { PricingType } from '@prisma/client'

export type Platform =
  | 'web'
  | 'mac'
  | 'windows'
  | 'linux'
  | 'ios'
  | 'android'
  | 'api'

export type CategorySummary = {
  id: string
  slug: string
  name: string
  icon: string
}

export type TagSummary = {
  id: string
  slug: string
  name: string
}

export type ToolResult = {
  id: string
  slug: string
  name: string
  tagline: string
  description: string
  website: string
  domain: string | null
  pricing: PricingType
  isOpenSource: boolean
  isPrivacyFocused: boolean
  platforms: string[]
  trustScore: number
  category: CategorySummary
  tags: TagSummary[]
  score?: number
  source?: 'db' | 'gemini'
  whyRelevant?: string
}

export type SearchRequest = {
  query: string
  filters?: {
    category?: string
    pricing?: PricingType | PricingType[]
    platforms?: string[]
    privacy?: boolean
    openSourceOnly?: boolean
  }
}

export type SearchResponse = {
  results: ToolResult[]
  query: string
  count: number
}

export type ApiError = {
  error: string
  code: string
}

export { PricingType }

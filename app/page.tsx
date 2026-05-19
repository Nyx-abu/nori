import { Hero } from '@/components/home/Hero'
import { FeaturedTools } from '@/components/home/FeaturedTools'
import { CategoryGrid } from '@/components/home/CategoryGrid'
import { WorkflowShowcase } from '@/components/home/WorkflowShowcase'

export default function HomePage() {
  return (
    <>
      <Hero />
      <FeaturedTools />
      <CategoryGrid />
      <WorkflowShowcase />
    </>
  )
}

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TheFooter from './TheFooter.vue'

describe('TheFooter', () => {
  describe('Basic Rendering', () => {
    it('renders the footer component', () => {
      const wrapper = mount(TheFooter)
      expect(wrapper.find('footer').exists()).toBe(true)
    })

    it('has correct CSS classes for styling', () => {
      const wrapper = mount(TheFooter)
      const footer = wrapper.find('footer')
      expect(footer.classes()).toContain('bg-white')
      expect(footer.classes()).toContain('border-t')
      expect(footer.classes()).toContain('border-gray-200')
      expect(footer.classes()).toContain('mt-16')
    })

    it('has proper container structure', () => {
      const wrapper = mount(TheFooter)
      const container = wrapper.find('.max-w-7xl')
      expect(container.exists()).toBe(true)
      expect(container.classes()).toContain('mx-auto')
      expect(container.classes()).toContain('px-4')
      expect(container.classes()).toContain('py-8')
    })
  })

  describe('Content Display', () => {
    it('displays the main application description', () => {
      const wrapper = mount(TheFooter)
      const description = wrapper.find('.text-gray-500')
      expect(description.exists()).toBe(true)
      expect(description.text()).toBe('vLLM Configuration Calculator - Optimize your large language model deployments')
    })

    it('displays the technology stack information', () => {
      const wrapper = mount(TheFooter)
      const techStack = wrapper.find('.text-gray-400')
      expect(techStack.exists()).toBe(true)
      expect(techStack.text()).toBe('Built with Vue.js, Tailwind CSS, and Chart.js')
    })

    it('has proper text styling classes', () => {
      const wrapper = mount(TheFooter)
      const description = wrapper.find('.text-gray-500')
      const techStack = wrapper.find('.text-gray-400')
      
      expect(description.classes()).toContain('text-sm')
      expect(techStack.classes()).toContain('text-xs')
      expect(techStack.classes()).toContain('mt-2')
    })
  })

  describe('Layout and Structure', () => {
    it('centers content properly', () => {
      const wrapper = mount(TheFooter)
      const centerDiv = wrapper.find('.text-center')
      expect(centerDiv.exists()).toBe(true)
    })

    it('has responsive padding classes', () => {
      const wrapper = mount(TheFooter)
      const container = wrapper.find('.max-w-7xl')
      expect(container.classes()).toContain('px-4')
      expect(container.classes()).toContain('sm:px-6')
      expect(container.classes()).toContain('lg:px-8')
    })
  })

  describe('Accessibility', () => {
    it('uses semantic footer element', () => {
      const wrapper = mount(TheFooter)
      expect(wrapper.find('footer').exists()).toBe(true)
    })

    it('has readable text contrast', () => {
      const wrapper = mount(TheFooter)
      const description = wrapper.find('.text-gray-500')
      const techStack = wrapper.find('.text-gray-400')
      
      // Verify appropriate text color classes for contrast
      expect(description.classes()).toContain('text-gray-500')
      expect(techStack.classes()).toContain('text-gray-400')
    })
  })

  describe('Component Props', () => {
    it('does not accept any props (static component)', () => {
      const wrapper = mount(TheFooter)
      expect(Object.keys(wrapper.props())).toHaveLength(0)
    })
  })

  describe('HTML Structure', () => {
    it('has correct HTML structure hierarchy', () => {
      const wrapper = mount(TheFooter)
      const html = wrapper.html()
      
      // Verify the structure: footer > div > div > p elements
      expect(html).toContain('<footer')
      expect(html).toContain('class="max-w-7xl mx-auto')
      expect(html).toContain('class="text-center"')
    })

    it('contains all expected text content', () => {
      const wrapper = mount(TheFooter)
      const text = wrapper.text()
      
      expect(text).toContain('vLLM Configuration Calculator')
      expect(text).toContain('Optimize your large language model deployments')
      expect(text).toContain('Built with Vue.js, Tailwind CSS, and Chart.js')
    })
  })
})

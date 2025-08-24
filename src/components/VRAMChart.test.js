import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VRAMChart from './VRAMChart.vue'

describe('VRAMChart.vue', () => {
  it('renders chart component', () => {
    const wrapper = mount(VRAMChart, {
      props: {
        title: 'Test Chart',
        data: {
          labels: ['Test GPU'],
          datasets: [{
            label: 'VRAM (GB)',
            backgroundColor: '#3B82F6',
            data: [24]
          }]
        }
      }
    })
    
    expect(wrapper.exists()).toBe(true)
  })

  it('uses default props when not provided', () => {
    const wrapper = mount(VRAMChart)
    
    expect(wrapper.exists()).toBe(true)
  })

  it('accepts custom title prop', () => {
    const customTitle = 'Custom VRAM Chart'
    const wrapper = mount(VRAMChart, {
      props: {
        title: customTitle
      }
    })
    
    expect(wrapper.props('title')).toBe(customTitle)
  })

  it('renders with bar chart component', () => {
    const wrapper = mount(VRAMChart)
    
    expect(wrapper.find('[data-testid="bar-chart"]').exists()).toBe(true)
  })
})

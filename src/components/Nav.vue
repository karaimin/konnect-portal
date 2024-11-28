<template>
  <header
    id="site-header"
    class="flex items-center fixed w-full top-0 z-10"
  >
    <div class="w-100 container max-w-screen-2xl mx-auto flex justify-between items-center px-5 md:px-0">
      <router-link to="/">
        <img
          class="logo"
          :src="logoSrc"
          :alt="helpText.nav.logoAlt"
        >
      </router-link>
      <nav class="flex items-center links">
        <router-link
          data-testid="catalog-link"
          :to="{ name: 'catalog' }"
          class="mr-2 p-2 catalog-link"
        >
          <div class="background-color-wrapper" />
          {{ helpText.nav.catalog }}
        </router-link>
        <KButton
          data-testid="ai-link"
          appearance="custom"
          :is-rounded="false"
          class="ai-nav-button"
          @click="$emit('openAiChat')"
        >
          <span class="robot-icon mr-1">🤖</span>
          AI Assistant
        </KButton>
        <NavDropdown
          v-if="developer && !isPublic"
          :label="developer.email"
          :items="[
            {
              label: helpText.userDropdown.myApps,
              routerLink: 'my-apps',
              testid: 'my-apps-item'
            }, {
              label: helpText.userDropdown.logout,
              onClick: () => logout(),
              testid: 'logout-item'
            }
          ]"
          data-testid="user-dropdown"
        />
      </nav>
    </div>
  </header>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { mapState, storeToRefs } from 'pinia'
import { useI18nStore, useAppStore } from '@/stores'
import NavDropdown from './NavDropdown.vue'
import usePortalApi from '@/hooks/usePortalApi'

export default defineComponent({
  name: 'Nav',
  components: { NavDropdown },
  setup () {
    const appStore = useAppStore()
    const { globalLoading } = storeToRefs(appStore)
    const helpText = useI18nStore().state.helpText

    const logout = async () => {
      globalLoading.value = true

      const logoutUrl = await appStore.logout()

      window.location.href = logoutUrl
    }
    const { portalApiV2 } = usePortalApi()
    const logoSrc = portalApiV2.value.getApiLink('/api/v2/portal/logo')

    return {
      logout,
      logoSrc,
      helpText
    }
  },

  computed: {
    ...mapState(useAppStore, {
      developer: store => store.developerSession.data?.developer,
      isPublic: 'isPublic'
    })
  }

})
</script>

<style lang="scss" scoped>
.logo {
  max-height: 41px;
}

#site-header {
  height: var(--headerHeight);
  background-color: var(--section_colors-header);
  border-bottom: 1px solid var(--section_colors-stroke);

  .links a {
    color: var(--text_colors-header);
    &:hover{
      backdrop-filter: brightness(1.35);
    }
  }
}

.ai-nav-button {
  margin-right: 1rem;
  padding: 0.25rem 0.75rem !important;
  font-weight: 500;
  font-size: 14px;
  height: 28px;
  min-width: auto !important;
  display: inline-flex;
  align-items: center;
  background-color: #8B3DFF !important;
  color: white !important;
  border: none !important;

  &:hover {
    background-color: #7433D9 !important;
  }

  .robot-icon {
    font-size: 14px;
    line-height: 1;
  }
}
</style>

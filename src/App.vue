<template>
  <div id="app">
    <div
      v-if="globalLoading"
      class="loading-container"
    >
      <KIcon
        icon="spinner"
        size="96"
        color="var(--steel-300)"
      />
    </div>
    <template v-else>
      <Nav
        v-if="isFullScreen"
        @openAiChat="isChatOpen = true"
      />

      <router-view
        v-slot="{ Component }"
        @openAiChat="isChatOpen = true"
      >
        <component
          :is="Component"
          :class="{'page': isFullScreen }"
        />
      </router-view>
    </template>

    <ChatDrawer
      :is-open="isChatOpen"
      @close="isChatOpen = false"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'
import { mapState, mapActions } from 'pinia'
import { ApiServiceAuthErrorReason } from '@/services/PortalV2ApiService'
import removeElementFromDOMById from '@/helpers/removeElementFromDOMById'
import { isAuthRoute } from '@/router/route-utils'
import Nav from '@/components/Nav.vue'
import { portalApiV2 } from '@/services'
import { useAppStore } from '@/stores'
import { createRedirectHandler } from './helpers/auth'
import { useHead } from '@unhead/vue'
import ChatDrawer from '@/components/ChatDrawer.vue'

const initialLoadingId = 'initial-fullscreen-loading-container'

export default defineComponent({
  name: 'App',
  components: {
    Nav,
    ChatDrawer
  },
  setup () {
    const { canonicalDomain } = useAppStore()
    const isChatOpen = ref(false)

    useHead({
      link: [{ rel: 'canonical', href: canonicalDomain }]
    })
    removeElementFromDOMById(initialLoadingId)

    return {
      isChatOpen
    }
  },
  computed: {
    ...mapState(useAppStore, ['globalLoading']),
    isFullScreen () {
      return !isAuthRoute(this.$route.name) && this.$route.name !== 'not-found-redirect'
    }
  },
  beforeMount () {
    this.initializeApiClients()
  },
  methods: {
    ...mapActions(useAppStore, ['logout']),
    initializeApiClients () {
      // Konnect API Client
      portalApiV2.setAuthErrorCallback(async (err, reason) => {
        // redirect to 403 page if portal api returns HTTP 403 but the session is correct
        if (reason === ApiServiceAuthErrorReason.RESPONSE_FORBIDDEN) {
          this.$router.replace({ name: 'forbidden' })

          return
        }

        if (err) {
          await createRedirectHandler(this.$router, this.logout)()
        }
      })
    }
  }
})
</script>

<style lang="scss">
// Import Kongponent var overrides
@import './assets/kongponents-theme.scss';

#app {
  hr {
    border-color: var(--section_colors-stroke);
  }

  .product-version {
    --KBadgeBorderRadius: 12px;
    --KBadgeMinWidth: auto;
    --KBadgePaddingY: 2px;
    --KBadgePaddingX: var(--spacing-sm);

    vertical-align: text-bottom;
  }
}

</style>

<style lang="scss">
  @import './assets/kongponents-theme.scss';
  .loading-container {
    position: fixed;
    top: 0;
    bottom: 0;
    right: 0;
    left: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10500;
    flex-direction: column;
    background: var(--white)
  }
</style>

<style lang="scss">
.chat-trigger {
  position: fixed;
  top: 12px;
  right: 20px;
  z-index: 1031;
  padding: var(--spacing-sm) var(--spacing-md) !important;
  min-width: auto !important;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  transition: all 0.2s ease;
}
</style>

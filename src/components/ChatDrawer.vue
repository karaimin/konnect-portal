<template>
  <Transition name="slide">
    <div
      v-if="isOpen"
      class="chat-drawer-overlay"
    >
      <div
        class="chat-drawer"
        :class="{ 'is-resizing': isResizingClass }"
        :style="{ width: `${drawerWidth}px` }"
      >
        <div
          class="resize-handle"
          @mousedown="startResize"
        />

        <div class="drawer-header">
          <h2>{{ helpText.chat.title }}</h2>
          <div class="header-actions">
            <KButton
              v-if="messages.length"
              appearance="btn-link"
              class="clear-button"
              data-testid="clear-chat"
              @click="messages = []"
            >
              <KIcon
                icon="trash"
                size="24"
              />
            </KButton>
            <KButton
              appearance="btn-link"
              @click="$emit('close')"
            >
              <KIcon
                icon="close"
                size="24"
              />
            </KButton>
          </div>
        </div>

        <div class="chat-container">
          <div
            ref="messagesContainer"
            class="messages-container"
          >
            <div
              v-for="message in messages"
              :key="message.id || message.tempId"
              :class="['message', message.type === 'human' ? 'user' : 'ai']"
            >
              <div
                class="message-content"
                v-html="renderMarkdown(message.content)"
              />
            </div>

            <div
              v-if="currentState.matches('pending')"
              class="message ai loading"
            >
              <div class="message-content">
                <span class="loading-dots" />
              </div>
            </div>
          </div>

          <div class="input-container">
            <form
              class="input-form"
              @submit.prevent="sendMessage"
            >
              <KInput
                v-model="userInput"
                type="text"
                :placeholder="helpText.chat.inputPlaceholder"
                :disabled="currentState.matches('pending')"
                class="chat-input"
              />
              <KButton
                appearance="primary"
                :is-rounded="false"
                type="submit"
                :disabled="!userInput.trim() || currentState.matches('pending')"
                class="send-button"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  style="transform: rotate(+45deg)"
                >
                  <path
                    d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </KButton>
            </form>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script lang="ts">
import { defineComponent, ref, nextTick, onUnmounted } from 'vue'
import { useMachine } from '@xstate/vue'
import { createMachine } from 'xstate'
import { useI18nStore } from '@/stores'
import useToaster from '@/composables/useToaster'
import { chatService, type ChatMessage } from '@/services/ChatService'
import { v4 as uuidv4 } from 'uuid'
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'

const md = new MarkdownIt({
  breaks: true,
  linkify: true,
  html: true,
  typographer: true,
  highlight: function (str, lang) {
    if (lang) {
      return `<pre class="language-${lang}"><code>${str}</code></pre>`
    }

    return `<pre><code>${str}</code></pre>`
  }
})

// Configure allowed tags and attributes
md.validateLink = function (url) {
  // Only allow http/https URLs
  return /^https?:\/\//i.test(url)
}

// Disable potentially dangerous HTML features
const originalRender = md.renderer.rules.link_open || function(tokens, idx, options, env, self) {
  return self.renderToken(tokens, idx, options)
}

md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  const token = tokens[idx]
  // Add noopener and noreferrer to all links
  token.attrPush(['rel', 'noopener noreferrer'])
  // Force links to open in new tab
  token.attrPush(['target', '_blank'])
  return originalRender(tokens, idx, options, env, self)
}

const renderMarkdown = (content: string) => {
  // First render markdown to HTML
  const html = md.render(content)
  
  // Then sanitize the HTML
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li', 
      'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'blockquote', 'hr'
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
    ALLOW_DATA_ATTR: false
  })
}

export default defineComponent({
  name: 'ChatDrawer',
  props: {
    isOpen: {
      type: Boolean,
      required: true
    }
  },
  emits: ['close'],
  setup () {
    // Reusing the same setup logic from Chat.vue
    const helpText = useI18nStore().state.helpText
    const { notify } = useToaster()
    const userInput = ref('')
    const messages = ref<(ChatMessage & { tempId?: string })[]>([])
    const messagesContainer = ref<HTMLElement | null>(null)

    const machine = createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: { SUBMIT: 'pending' }
        },
        pending: {
          on: {
            RESOLVE: 'idle',
            REJECT: 'error'
          }
        },
        error: {
          on: { SUBMIT: 'pending' }
        }
      }
    })

    const { state: currentState, send } = useMachine(machine)

    // Reusing the same methods from Chat.vue
    const scrollToBottom = async () => {
      await nextTick()
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
      }
    }

    const sendMessage = async () => {
      if (!userInput.value.trim() || currentState.value.matches('pending')) return

      send('SUBMIT')

      const tempMessage: ChatMessage & { tempId: string } = {
        content: userInput.value,
        type: 'human',
        tempId: uuidv4()
      }

      messages.value.push(tempMessage)
      userInput.value = ''
      await scrollToBottom()

      try {
        const response = await chatService.sendMessage(messages.value)

        messages.value = response.output.messages
        send('RESOLVE')
        await scrollToBottom()
      } catch (error) {
        send('REJECT')
        notify({
          appearance: 'danger',
          message: helpText.chat.error
        })
        messages.value = messages.value.filter(msg => msg.tempId !== tempMessage.tempId)
      }
    }

    const drawerWidth = ref(450)
    const minWidth = 300
    const maxWidth = 800
    let isResizing = false

    const debounce = (fn: Function, ms = 16) => {
      let timeoutId: ReturnType<typeof setTimeout>

      return function (this: any, ...args: any[]) {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => fn.apply(this, args), ms)
      }
    }

    const handleResize = debounce((event: MouseEvent) => {
      if (!isResizing) return

      const newWidth = window.innerWidth - event.clientX

      drawerWidth.value = Math.min(Math.max(newWidth, minWidth), maxWidth)
    })

    const isResizingClass = ref(false)

    const startResize = () => {
      isResizing = true
      isResizingClass.value = true
      document.addEventListener('mousemove', handleResize)
      document.addEventListener('mouseup', stopResize)
      document.body.style.userSelect = 'none'
    }

    const stopResize = () => {
      isResizing = false
      isResizingClass.value = false
      document.removeEventListener('mousemove', handleResize)
      document.removeEventListener('mouseup', stopResize)
      document.body.style.userSelect = ''
    }

    onUnmounted(() => {
      document.removeEventListener('mousemove', handleResize)
      document.removeEventListener('mouseup', stopResize)
    })

    return {
      helpText,
      userInput,
      messages,
      sendMessage,
      messagesContainer,
      currentState,
      renderMarkdown,
      drawerWidth,
      isResizingClass,
      startResize
    }
  }
})
</script>

<style lang="scss" scoped>
// Transition animations
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  .chat-drawer {
    transform: translateX(100%);
  }
}

// Overlay
.chat-drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  z-index: 9998;
}

// Drawer
.chat-drawer {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  background-color: var(--section_colors-tertiary, #FFFFFF);
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.2);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--section_colors-stroke);
  transition: transform 0.3s ease;
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--section_colors-stroke);
  background-color: var(--section_colors-tertiary);
  height: 60px;
  flex-shrink: 0;

  h2 {
    margin: 0;
    font-size: 1.25rem;
    color: var(--text_colors-primary);
  }

  .header-actions {
    display: flex;
    gap: var(--spacing-sm);
    align-items: center;
  }

  .clear-button {
    color: var(--text_colors-secondary);
    transition: all 0.2s ease;
    background: transparent !important;

    &:hover:not(:disabled) {
      color: var(--red-500);
      background: transparent !important;
    }

    &:disabled {
      color: var(--text_colors-secondary);
      opacity: 0.5;
      cursor: not-allowed;
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
    }
  }
}

.chat-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  background-color: var(--section_colors-tertiary, #FFFFFF);
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
  margin-bottom: 80px;
  background-color: var(--section_colors-tertiary, #FFFFFF);
}

.message {
  margin-bottom: var(--spacing-md);
  max-width: 70%;
  display: flex;
  width: 100%;

  .message-content {
    padding: var(--spacing-sm) var(--spacing-md);

    :deep(p) {
      margin: 0 0 1em;
      line-height: 1.5;

      &:last-child {
        margin-bottom: 0;
      }
    }

    :deep(h1, h2, h3, h4, h5, h6) {
      margin: 1.5em 0 0.5em;
      color: var(--text_colors-headings);
      font-family: var(--font-family-headings);
      line-height: 1.2;

      &:first-child {
        margin-top: 0;
      }
    }

    :deep(h1) { font-size: 1.5em; }
    :deep(h2) { font-size: 1.3em; }
    :deep(h3) { font-size: 1.2em; }
    :deep(h4) { font-size: 1.1em; }
    :deep(h5, h6) { font-size: 1em; }

    :deep(pre) {
      background: var(--section_colors-primary);
      padding: 1em;
      border-radius: 4px;
      margin: 1em 0;
      overflow-x: auto;
      border: 1px solid var(--section_colors-stroke);

      code {
        background: none;
        padding: 0;
        font-family: var(--font-family-mono);
      }
    }

    :deep(code) {
      background: var(--section_colors-primary);
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-family: var(--font-family-mono);
      font-size: 0.9em;
    }

    :deep(ul, ol) {
      margin: 0 0 1em;
      padding-left: 2em;
    }

    :deep(li) {
      margin: 0.5em 0;
    }

    :deep(hr) {
      border: none;
      border-top: 1px solid var(--section_colors-stroke);
      margin: 1.5em 0;
    }

    :deep(blockquote) {
      margin: 1em 0;
      padding-left: 1em;
      border-left: 4px solid var(--section_colors-stroke);
      color: var(--text_colors-secondary);
    }
  }

  &.user {
    margin-left: auto;
    justify-content: flex-end;
    .message-content {
      background-color: var(--button_colors-primary-fill);
      color: var(--white);
      border-radius: 1.2rem 1.2rem 0.3rem 1.2rem;
    }
  }

  &.ai {
    margin-right: auto;
    justify-content: flex-start;
    position: relative;
    padding-left: 40px;

    &::before {
      content: '🤖';
      position: absolute;
      left: 0;
      top: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #1b2b4b;
      border-radius: 50%;
      font-size: 20px;
    }

    &.loading {
      .message-content {
        display: flex;
        align-items: center;
        gap: 4px;
        min-width: 60px;

        .loading-dots {
          display: inline-block;
          &::after {
            content: "...";
            width: 1.25em;
            animation: loading 1.5s infinite;
          }
        }
      }
    }

    .message-content {
      background-color: #1b2b4b;
      color: var(--white);
      border-radius: 1.2rem 1.2rem 1.2rem 0.3rem;
    }
  }
}

.input-container {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: var(--spacing-md);
  background-color: var(--section_colors-tertiary, #FFFFFF);
  border-top: 1px solid var(--section_colors-stroke);
}

.input-form {
  display: flex;
  gap: var(--spacing-md);
  width: 100%;
}

.chat-input {
  flex: 1;
}

.send-button {
  flex-shrink: 0;
  padding: var(--spacing-sm);
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    color: white;
  }
}

@keyframes loading {
  0% { content: "."; }
  33% { content: ".."; }
  66% { content: "..."; }
}

.resize-handle {
  position: absolute;
  left: 0;
  top: 0;
  width: 4px;
  height: 100%;
  cursor: ew-resize;
  background-color: transparent;
  transition: background-color 0.2s;

  &:hover, &:active {
    background-color: var(--button_colors-primary-fill);
  }

  &::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    height: 40px;
    width: 2px;
    background-color: var(--section_colors-stroke);
    opacity: 0;
    transition: opacity 0.2s;
  }

  &:hover::after {
    opacity: 1;
  }
}

.is-resizing {
  user-select: none;
  cursor: ew-resize;

  .resize-handle {
    background-color: var(--button_colors-primary-fill);
    &::after {
      opacity: 1;
    }
  }
}
</style>

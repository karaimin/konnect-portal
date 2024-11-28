<template>
  <Content>
    <PageTitle
      :title="helpText.chat.title"
      class="mb-6"
    />

    <div class="chat-container">
      <div
        ref="messagesContainer"
        class="messages-container"
        data-testid="chat-messages"
      >
        <div
          v-for="message in messages"
          :key="message.id || message.tempId"
          :class="['message', message.type === 'human' ? 'user' : 'ai']"
          :data-testid="`chat-message-${message.type}`"
        >
          <div
            class="message-content"
            v-text="renderMarkdown(message.content)"
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
            data-testid="chat-input"
            @keyup.enter="sendMessage"
          />
          <KButton
            appearance="primary"
            :is-rounded="false"
            type="submit"
            :disabled="!userInput.trim() || currentState.matches('pending')"
            data-testid="send-message-button"
            class="send-button"
          >
            {{ helpText.chat.send }}
          </KButton>
        </form>
      </div>
    </div>
  </Content>
</template>

<script lang="ts">
import { defineComponent, ref, nextTick } from 'vue'
import { useMachine } from '@xstate/vue'
import { createMachine } from 'xstate'
import { useI18nStore } from '@/stores'
import PageTitle from '@/components/PageTitle.vue'
import useToaster from '@/composables/useToaster'
import { chatService, type ChatMessage } from '@/services/ChatService'
import { v4 as uuidv4 } from 'uuid'
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({
  breaks: true, // Convert '\n' to <br>
  linkify: true // Convert URLs to links
})

export default defineComponent({
  name: 'Chat',
  components: {
    PageTitle
  },
  setup () {
    const helpText = useI18nStore().state.helpText
    const { notify } = useToaster()
    const userInput = ref('')
    const messages = ref<(ChatMessage & { tempId?: string })[]>([])
    const messagesContainer = ref<HTMLElement | null>(null)

    // Create XState machine for handling chat states
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

    const scrollToBottom = async () => {
      await nextTick()
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
      }
    }

    const sendMessage = async () => {
      if (!userInput.value.trim() || currentState.value === 'pending') return

      send('SUBMIT')

      // Add user message with temporary ID
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

        // Update messages with the complete chat history from the server
        messages.value = response.output.messages

        send('RESOLVE')
        await scrollToBottom()
      } catch (error) {
        send('REJECT')
        notify({
          appearance: 'danger',
          message: helpText.chat.error
        })

        // Remove the temporary message on error
        messages.value = messages.value.filter(msg => msg.tempId !== tempMessage.tempId)
      }
    }

    const renderMarkdown = (content: string) => {
      return md.render(content)
    }

    return {
      helpText,
      userInput,
      messages,
      sendMessage,
      messagesContainer,
      currentState,
      renderMarkdown
    }
  }
})
</script>

<style lang="scss" scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--headerHeight) - 200px);
  position: relative;
  background: var(--section_colors-primary);
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
  margin-bottom: 80px;
}

.message {
  margin-bottom: var(--spacing-md);
  max-width: 70%;
  display: flex;
  width: 100%;

  .message-content {
    padding: var(--spacing-sm) var(--spacing-lg);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    line-height: 1.5;
  }

  &.user {
    margin-left: auto;
    justify-content: flex-end;
    .message-content {
      background-color: var(--button_colors-primary-fill);
      color: var(--white);
      border-radius: 1.2rem 1.2rem 0.3rem 1.2rem;
      transform: translateZ(0);
    }
  }

  &.ai {
    margin-right: auto;
    justify-content: flex-start;
    position: relative;
    padding-left: 40px;
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
      background-color: var(--steel-300);
      border-radius: 50%;
      font-size: 20px;
    }

    // Loading animation styles
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
      background-color: var(--steel-300);
      color: var(--white);
      border-radius: 1.2rem 1.2rem 1.2rem 0.3rem;
      transform: translateZ(0);
    }
  }
}

.message-content {
  padding: var(--spacing-sm) var(--spacing-md);

  :deep(p) {
    margin: 0;
    line-height: 1.5;
  }

  :deep(p:not(:last-child)) {
    margin-bottom: 0.5em;
  }

  :deep(a) {
    color: inherit;
    text-decoration: underline;
  }

  :deep(code) {
    background: rgba(0, 0, 0, 0.1);
    padding: 2px 4px;
    border-radius: 3px;
  }

  :deep(pre) {
    background: rgba(0, 0, 0, 0.1);
    padding: 1em;
    border-radius: 4px;
    overflow-x: auto;

    code {
      background: none;
      padding: 0;
    }
  }
}

.input-container {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: var(--spacing-md);
  background: var(--section_colors-primary);
  border-top: 1px solid var(--section_colors-stroke);
}

.input-form {
  display: flex;
  gap: var(--spacing-md);
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.chat-input {
  flex: 1;
}

.send-button {
  flex-shrink: 0;
}

.message-enter-active {
  transition: all 0.3s ease;
}
.message-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

@keyframes loading {
  0% { content: "."; }
  33% { content: ".."; }
  66% { content: "..."; }
}
</style>

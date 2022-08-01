const { Plugin } = require('powercord/entities')
const {
  getModule,
  FluxDispatcher: Dispatcher,
  channels: { getChannelId }
} = require('powercord/webpack')

class QuickReply extends Plugin {
  constructor() {
    super()

    this.messageIndex = -1
    this.activeChannel = getChannelId()
    this.replyingToMessage = undefined

    this.QRSymbol = Symbol('quickreply_deletePendingReply_int')
  }

  getCurrentChannel() {
    return this.getChannel(getChannelId())
  }

  async createPendingReply(channel, message, shouldMention, showMentionToggle) {
    if (typeof showMentionToggle === 'undefined') {
      showMentionToggle = channel.guild_id !== null // DM channel showMentionToggle = false
    }
    Dispatcher.dirtyDispatch({
      type: 'CREATE_PENDING_REPLY',
      channel,
      message,
      shouldMention,
      showMentionToggle,
    })
    this.jumpToMessage({
      channelId: channel.id,
      messageId: message.id,
      flash: true,
      returnMessageId: channel.lastMessageId
    })
  }
  async deletePendingReply(data) {
    Dispatcher.dirtyDispatch({
      type: 'DELETE_PENDING_REPLY',
      channelId: getChannelId(),
      ...data,
    })
  }

  channelSelect = (data) => {
    if (this.activeChannel !== data.channelId) {
      this.activeChannel = data.channelId
      this.messageIndex = -1
    }
  }
  onCreatePendingReply = (data) => {
    if (this.replyingToMessage !== data.message.id) {
      this.replyingToMessage = data.message.id
    }
  }
  onDeletePendingReply = (data) => {
    this.replyingToMessage = undefined
    if (!data[this.QRSymbol]) {
      this.messageIndex = -1
    }
  }

  keyDown = async (event) => {
    if (!event.ctrlKey) return
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      let messages = await this.getMessages(getChannelId())
      let msgArray = messages.toArray().reverse()

      let lastIndex =
        msgArray.findIndex((msg) => msg.id === this.replyingToMessage) || 0
      if (event.key === 'ArrowUp') {
        this.messageIndex = lastIndex + 1
      } else if (event.key === 'ArrowDown') {
        this.messageIndex = lastIndex - 1
      }

      if (this.messageIndex > msgArray.length) this.messageIndex = msgArray.length
      if (this.messageIndex < 0) {
        return this.deletePendingReply()
      }

      let message = msgArray[this.messageIndex]
      this.deletePendingReply({
        [this.QRSymbol]: true,
      })
      this.createPendingReply(this.getCurrentChannel(), message, true)
    } else if (event.key === 'Delete' && this.replyingToMessage) {
      let messages = await this.getMessages(getChannelId())
      let msgArray = messages.toArray().reverse()
      let message = msgArray[this.messageIndex]

      this.deletePendingReply({
        [this.QRSymbol]: true,
      })
      this.deleteMessage(this.getCurrentChannel().id, message.id)
    }
  }

  async startPlugin() {
    const { getChannel } = await getModule(['getChannel', 'getDMFromUserId'])
    const { getMessages } = await getModule(['getMessages'])
    const { jumpToMessage, deleteMessage } = await getModule(['jumpToMessage', 'deleteMessage'])
    this.getChannel = getChannel
    this.getMessages = getMessages
    this.jumpToMessage = jumpToMessage
    this.deleteMessage = deleteMessage

    Dispatcher.subscribe('CHANNEL_SELECT', this.channelSelect)
    Dispatcher.subscribe(
      'CREATE_PENDING_REPLY',
      this.onCreatePendingReply
    )
    Dispatcher.subscribe(
      'DELETE_PENDING_REPLY',
      this.onDeletePendingReply
    )

    window.addEventListener('keydown', this.keyDown)
  }

  pluginWillUnload() {
    Dispatcher.unsubscribe('CHANNEL_SELECT', this.channelSelect)
    Dispatcher.unsubscribe(
      'CREATE_PENDING_REPLY',
      this.onCreatePendingReply
    )
    Dispatcher.unsubscribe(
      'DELETE_PENDING_REPLY',
      this.onDeletePendingReply
    )
    window.removeEventListener('keydown', this.keyDown)
  }
}

module.exports = QuickReply

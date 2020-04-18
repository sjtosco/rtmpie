import { sortBy } from 'lodash'
import api from 'api'
import { config } from 'utils'

const byStatusAndName = [({ live }) => !live, ({ name }) => name.toLowerCase()]

const createStreamsModule = () => ({
  namespaced: true,
  state: {
    streams: [],
    thumbnails: {},
    hasSseError: false,
  },
  getters: {
    all: ({ streams }) => sortBy(streams, byStatusAndName),
    byId: (state, { all }) => id => all.find((stream) => stream.id === parseInt(id, 10)) || null,
    liveStreams: (state, { all }) => all.filter(({ live }) => live),
    thumbnailById: ({ thumbnails }) => id => thumbnails[id] || null,
    hasSseError: ({ hasSseError }) => hasSseError,
  },
  mutations: {
    setStreams(state, streams) {
      state.streams = streams
    },
    setThumbnails(state, thumbnails) {
      state.thumbnails = thumbnails
    },
    addOrUpdate(state, data) {
      if (JSON.stringify(Object.keys(data)) === '["@id"]') {
        // Resource was deleted by API Platform, ignore
        return
      }

      const index = state.streams.findIndex(({ id }) => id === data.id);
      if (index >= 0) {
        Object.assign(state.streams[index], data)
      } else {
        state.streams.push(data)
      }
    },
    hasSseError(state) {
      state.hasSseError = true
    },
  },
  actions: {
    async init({ commit, dispatch }) {
      await dispatch('fetch')

      // Watch for Server Sent Events
      const url = new URL(config('sseHost'));
      url.searchParams.append('topic', '/api/streams/{id}');
      // TODO: this is necessary to catch updates triggered by API Platform
      url.searchParams.append('topic', 'http://127.0.0.1:8000/api/streams/{id}');
      const eventSource = new EventSource(url);
      eventSource.onmessage = ({ data }) => commit('addOrUpdate', JSON.parse(data))
      eventSource.onerror = () => {
        eventSource.close()
        commit('hasSseError')
      }
    },
    fetch({ commit }) {
      return api('streams')
        .then(({ data }) => {
          commit('setStreams', data)
          return data
        })
    },
    fetchThumbnails({ commit }) {
      return api('thumbnails')
        .then(({ data }) => {
          commit('setThumbnails', data)
          return data
        })
    },
    create({ dispatch }, name) {
      return api.post('streams', { name })
        .then(({ data }) => {
          dispatch('fetch')
          return data
        })
    },
    update({ dispatch }, { id, data }) {
      return api.put(`streams/${id}`, data)
        .then(() => {
          dispatch('fetch')
        })
    },
    delete({ dispatch }, id) {
      return api.delete(`streams/${id}`)
        .then(() => {
          dispatch('fetch')
        })
    }
  },
})

export default createStreamsModule
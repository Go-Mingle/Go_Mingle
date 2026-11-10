import { amenities, interests, preferenceOptions, preferenceQuestions, topics } from '../db/schema'
import { registerSeed } from './seed'
import { starterAmenities, starterInterests, starterPreferenceQuestions, starterTopics } from './catalog'

/**
 * Fills the four pick-list catalogues with the starter set, once per install,
 * for whichever of them is still empty. After that they are the admins' to
 * edit; deleting entries never brings them back.
 */
registerSeed({
  key: 'starterCatalog',
  async run(db) {
    if ((await db.$count(amenities)) === 0) {
      await db.insert(amenities).values(starterAmenities().map((a) => ({ id: a.id, name: a.name, iconUrl: a.iconUrl, createdAt: a.createdAt, updatedAt: a.updatedAt })))
    }
    const startInterests = starterInterests()
    if ((await db.$count(interests)) === 0) await db.insert(interests).values(startInterests)
    if ((await db.$count(topics)) === 0) {
      const current = await db.select().from(interests)
      const snapshot = current.map((i) => ({ id: i.id, name: i.name, groupName: i.groupName as string, createdAt: i.createdAt, updatedAt: i.updatedAt as null }))
      await db.insert(topics).values(
        starterTopics(snapshot).map((t) => ({ id: t.id, name: t.name, description: t.description, graphicUrl: t.graphicUrl, interests: t.interests, createdAt: t.createdAt })),
      )
    }
    if ((await db.$count(preferenceQuestions)) === 0) {
      const seed = starterPreferenceQuestions()
      await db.insert(preferenceQuestions).values(seed.questions.map((q) => ({ id: q.id, question: q.question, type: q.type, questionOrder: q.questionOrder, createdAt: q.createdAt })))
      await db.insert(preferenceOptions).values(
        Object.entries(seed.optionsById).flatMap(([questionId, opts]) => opts.map((o, position) => ({ ...o, questionId, position }))),
      )
    }
  },
})

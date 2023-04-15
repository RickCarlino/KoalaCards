import { z } from 'zod';
import { procedure, router } from '../trpc';
import { dataURItoBlob } from '@/utils/from-data-url';
export const appRouter = router({
  performExam: procedure.input(z.object({
    audio: z.any(),
    phraseID: z.number()
  })).mutation(async (params) => {
    console.log(dataURItoBlob(params.input.audio));
    debugger;
    return {
      result: "success",
      score: 100
    };
  })
});
// export type definition of API
export type AppRouter = typeof appRouter;

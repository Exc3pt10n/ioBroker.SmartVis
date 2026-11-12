import { expect } from 'chai';
import { clipToRange, timeWeightedAverage, type Point } from '../shared/series';

const h = 3600_000;

describe('Zeitreihen', () => {
    it('mittelt zeitgewichtet: wenige Nachtpunkte zählen ihre ganze Dauer', () => {
        // 12 h Tag mit 4 kW (viele Punkte), 12 h Nacht mit 0 (ein Punkt)
        const day: Point[] = Array.from({ length: 48 }, (_, i) => [i * 0.25 * h, 4]);
        const points: Point[] = [...day, [12 * h, 0]];
        const naive = points.reduce((a, p) => a + p[1], 0) / points.length;
        expect(naive).to.be.closeTo(3.92, 0.01);
        expect(timeWeightedAverage(points, 24 * h)).to.be.closeTo(2, 1e-9);
    });

    it('kommt mit einzelnen oder fehlenden Punkten zurecht', () => {
        expect(timeWeightedAverage([])).to.equal(undefined);
        expect(timeWeightedAverage([[0, 5]])).to.equal(5);
        expect(timeWeightedAverage([[0, 5]], h)).to.equal(5);
    });

    it('schneidet auf den Zeitraum zu und übernimmt den Wert vom Beginn', () => {
        const points: Point[] = [
            [-2 * h, 1],
            [-h, 3],
            [h, 5],
            [3 * h, 7],
        ];
        expect(clipToRange(points, 0, 2 * h)).to.deep.equal([
            [0, 3],
            [h, 5],
        ]);
        // Liegt schon ein Punkt genau am Anfang, bleibt es dabei
        expect(
            clipToRange(
                [
                    [-h, 1],
                    [0, 2],
                ],
                0,
                h,
            ),
        ).to.deep.equal([[0, 2]]);
        expect(clipToRange([[-h, 1]], 0, h)).to.deep.equal([[0, 1]]);
    });
});

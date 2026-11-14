import { expect } from 'chai';
import { anonymizeDiagnosis } from '../shared/anonymize';
import { buildDiagnosis } from './diagnosis';
import { discover } from './discovery';
import { Tree } from './fixtures/build';
import { tuyaTree } from './fixtures/tuya';

describe('Diagnose der Erkennung', () => {
    const tree = tuyaTree();
    // Ein Kanal mit Messwert, den der type-detector nicht zuordnet, und ein Info-Kanal (zählt nicht)
    tree.objects['tuya.0.info'] = new Tree().channel('tuya.0.info', 'Information').objects['tuya.0.info'];
    tree.state('tuya.0.info.connection', { type: 'boolean', role: 'indicator.connected' });
    const result = discover(tree.objects, { language: 'de', ignoreAdapters: [] });
    const report = buildDiagnosis(result, 'de');

    it('zählt erkannte Geräte je Adapter und markiert unterstützte Adapter', () => {
        const tuya = report.adapters.find(a => a.adapter === 'tuya');
        expect(tuya?.devices).to.equal(result.model.devices.filter(d => d.adapter === 'tuya').length);
        expect(tuya?.supported).to.equal(true);
    });

    it('listet Geräte ohne Kachel mit Datenpunkten und Grund, ohne Info-Kanäle', () => {
        const pir = report.unmatched.find(e => e.id === 'tuya.0.bf8234567890abcdef');
        expect(pir?.name).to.equal('Bewegung Garage');
        expect(pir?.reason).to.equal('no-match');
        expect(pir?.states.find(s => s.key === '1')).to.include({ role: 'value', code: 'pir' });
        expect(report.unmatched.some(e => e.id.endsWith('.info'))).to.equal(false);
    });

    it('anonymisiert den Bericht: keine IDs, Namen oder Gerätekennungen', () => {
        const anon = anonymizeDiagnosis(report, '0.10.0');
        const text = JSON.stringify(anon);
        expect(text).not.to.include('Bewegung Garage');
        expect(text).not.to.include('bf8234567890abcdef');
        expect(anon.unmatched[0]).to.include({ adapter: 'tuya', key: '…', reason: 'no-match' });
        expect(anon.unmatched[0].states.map(s => s.code)).to.include('pir');
    });
});

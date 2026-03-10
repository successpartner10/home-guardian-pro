import { useState, useEffect } from "react";

export interface BatteryStatus {
    level: number;
    isCharging: boolean;
    isLowBattery: boolean;
    supported: boolean;
}

export const useBattery = () => {
    const [status, setStatus] = useState<BatteryStatus>({
        level: 100,
        isCharging: true,
        isLowBattery: false,
        supported: true,
    });

    useEffect(() => {
        let battery: any = null;

        const updateBatteryInfo = () => {
            const level = Math.round(battery.level * 100);
            setStatus({
                level,
                isCharging: battery.charging,
                isLowBattery: level <= 20 && !battery.charging,
                supported: true,
            });
        };

        if ("getBattery" in navigator) {
            (navigator as any).getBattery().then((batt: any) => {
                battery = batt;
                updateBatteryInfo();

                battery.addEventListener("chargingchange", updateBatteryInfo);
                battery.addEventListener("levelchange", updateBatteryInfo);
            });
        } else {
            setStatus(s => ({ ...s, supported: false }));
        }

        return () => {
            if (battery) {
                battery.removeEventListener("chargingchange", updateBatteryInfo);
                battery.removeEventListener("levelchange", updateBatteryInfo);
            }
        };
    }, []);

    return status;
};
